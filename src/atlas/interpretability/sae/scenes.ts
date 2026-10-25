import { type Scene, type SceneDef, lerp } from '../../../lecture/scene';
import { cells, columns, frame, num, rich } from '../draw';

/** A bar standing for a vector, `w` stage units wide, centered on (x, y). */
function slab(s: Scene, x: number, y: number, w: number, label: string, k: 'orange' | 'purple' | 'green', on = 0): void {
  s.rrect(x - (w / 2) * s.u, y - 4 * s.u, w * s.u, 8 * s.u, 1.2, { fill: s.tint(k, 0.14 + 0.2 * on), stroke: s.tint(k, 0.6 + 0.4 * on), lw: 0.35 });
  s.text(label, x, y + 0.2 * s.u, { size: 3.2, font: 'mono', weight: 600, color: s.c(k) });
}

const LIT = [3, 11];

const wide: SceneDef = {
  draw(s) {
    const cx = s.w / 2;
    const D = 26;
    const flip = s.ease('flip', 1.2);
    const mid = lerp(10, s.tall ? 92 : 104, flip);
    const ys = [s.h * 0.14, s.h * 0.38, s.h * 0.62];
    slab(s, cx, ys[0]!, D, 'x: d', 'orange');
    const join = (y0: number, w0: number, y1: number, w1: number) => {
      s.line(cx - (w0 / 2) * s.u, y0 + 4 * s.u, cx - (w1 / 2) * s.u, y1 - 4 * s.u, s.c('--ink-3'), 0.3);
      s.line(cx + (w0 / 2) * s.u, y0 + 4 * s.u, cx + (w1 / 2) * s.u, y1 - 4 * s.u, s.c('--ink-3'), 0.3);
    };
    join(ys[0]!, D, ys[1]!, mid);
    join(ys[1]!, mid, ys[2]!, D);
    const dict = s.ease('dict', 0.6);
    s.alpha(1 - dict, () => slab(s, cx, ys[1]!, mid, flip > 0.5 ? 'm = 8d features' : '', 'purple', flip));
    s.alpha(dict, () => {
      const n = 16;
      const xs = columns(s, n, mid / n);
      xs.forEach((x, i) => s.cell(x - (mid / n / 2 - 0.3) * s.u, ys[1]! - 4 * s.u, (mid / n - 0.6) * s.u, 8 * s.u, '', 'purple', { on: LIT.includes(i) ? 1 : 0 }));
      s.text('few features on', cx, ys[1]! - 7 * s.u, { size: 3, font: 'mono', color: s.c('purple') });
    });
    slab(s, cx, ys[2]!, D, 'x̂: d', 'green');
    s.alpha(s.win('recall', 'flip'), () => s.text('ordinary autoencoder: a narrow middle', cx, s.h * 0.8, { size: 3.4, color: s.c('--ink-2') }));
    s.alpha(s.ease('flip', 0.6, 1.5) * (1 - dict), () => s.text('sparse autoencoder: a wide middle', cx, s.h * 0.8, { size: 3.4, weight: 600, color: s.c('purple') }));
    s.alpha(s.ease('dict', 0.6, 1), () => s.text('each feature: one direction in the decoder', cx, s.h * 0.8, { size: s.tall ? 3.2 : 3.4, color: s.c('purple') }));
  },
};

const CODE = [0, 2, 0, 0, 0.5, 0, 0, 0];
const LOOSE = [0.3, 1.8, 0.2, 0.1, 0.6, 0.3, 0.2, 0.1];

const loss: SceneDef = {
  marks: {
    l: { tex: String.raw`\symL = \lVert \symx - \hat{\symx} \rVert^2 + \symlam \textstyle\sum_j \sym{f}{f}_j`, x: 0.5, y: 0.1, size: 5 },
  },
  draw(s) {
    s.show('l', s.ease('err', 0.6));
    const xs = columns(s, 8, s.tall ? 12.4 : 13);
    const zero = s.ease('zero', 1.4, 1);
    s.alpha(s.ease('l1', 0.6), () => {
      const vals = CODE.map((v, i) => lerp(v, LOOSE[i]!, s.ease('zero', 0.5) * (1 - zero)));
      s.text(s.ease('zero', 0.4) > 0.5 && zero < 0.5 ? 'without the penalty' : 'the code f', s.w / 2, s.h * 0.3, { size: 3.2, color: s.c('--ink-3') });
      cells(s, xs, s.h * 0.38, vals.map((v) => num(Math.round(v * 10) / 10)), 'purple', { w: 11, h: 8, size: 3, on: vals.map((v) => (v > 0 ? 1 : 0)) });
    });
    s.alpha(s.ease('l1', 0.6, 4) * (1 - s.ease('zero', 0.5)), () => {
      rich(s, [['λ Σ f = 0.1 × (2 + 0.5) = ', '--ink-2'], ['0.25', 'red']], s.w / 2, s.h * 0.56, { size: s.tall ? 3.4 : 3.8 });
    });
    s.alpha(s.ease('zero', 0.6, 2.4), () => {
      s.text('small ones pushed to exactly 0', s.w / 2, s.h * 0.56, { size: 3.6, weight: 600, color: s.c('purple') });
    });
  },
};

const rebuild: SceneDef = {
  draw(s) {
    const side = Math.min(s.h * 0.56, s.w * 0.6);
    const l = s.w / 2 - side / 2;
    const F = frame(l, s.h * 0.06, l + side, s.h * 0.06 + side, [-0.4, 2.6], [-0.4, 2.6]);
    s.line(F.X(-0.4), F.Y(0), F.X(2.6), F.Y(0), s.c('--axis'), 0.25);
    s.line(F.X(0), F.Y(-0.4), F.X(0), F.Y(2.6), s.c('--axis'), 0.25);
    const a = s.ease('sum', 0.6);
    const b = s.ease('sum', 0.6, 3);
    const c = s.ease('sum', 0.8, 6);
    s.alpha(a, () => {
      s.arrow(F.X(0), F.Y(0), F.X(2), F.Y(0), s.c('teal'), 0.55, 2.4);
      s.text('2 × [1, 0]', F.X(1), F.Y(0) + 4 * s.u, { size: 3, font: 'mono', color: s.c('teal'), halo: true });
    });
    s.alpha(b, () => {
      s.arrow(F.X(2), F.Y(0), F.X(2), F.Y(1), s.c('gold'), 0.55, 2.4);
      s.text('0.5 × [0, 2]', F.X(2) + 2 * s.u, F.Y(0.5), { size: 3, font: 'mono', align: 'left', color: s.c('gold'), halo: true });
    });
    s.alpha(c, () => {
      s.arrow(F.X(0), F.Y(0), F.X(2), F.Y(1), s.c('green'), 0.7, 2.6);
      s.text('x̂ = [2, 1]', F.X(2) + 1.5 * s.u, F.Y(1.25), { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('green'), halo: true });
    });
    s.alpha(c, () => {
      rich(s, [['x̂ = ', 'green'], ['2·[1, 0]', 'teal'], [' + ', '--ink-2'], ['0.5·[0, 2]', 'gold'], [' = [2, 1]', 'green']], s.w / 2, s.h * 0.74, { size: s.tall ? 3.3 : 3.6 });
    });
    s.alpha(s.ease('meaning', 0.6), () => s.text('few features per input: each can mean one thing', s.w / 2, s.h * 0.88, { size: s.tall ? 3.2 : 3.6, weight: 600, color: s.c('purple') }));
  },
};

export const scenes: Record<string, SceneDef> = { wide, loss, rebuild };

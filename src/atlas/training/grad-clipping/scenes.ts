import type { Color } from '../../../core/symbols';
import { type Scene, type SceneDef, lerp } from '../../../lecture/scene';
import { axes, ball, clipped, curve, frame, type Frame, xTicks, yTicks } from '../draw';

type Ink = Color | `--${string}`;

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** A caption centered under the picture. */
function caption(s: Scene, text: string, k: Ink, a: number, y = s.h - 5 * s.u) {
  s.alpha(a, () => s.text(text, s.w / 2, y, { size: 3.5, font: 'mono', weight: 600, color: s.c(k), halo: true }));
}

// ---- the wall: an exploded slope throws w across the valley; a cut one does not

const sig = (z: number) => 1 / (1 + Math.exp(-z));
/** A valley with its floor at w = 2 and a wall at w = 4, steep enough that the slope there is 50. */
const K = (50 - 0.8) / 0.75;
const loss = (w: number) => 0.4 * (w - 2) ** 2 + 3 * sig(K * (w - 4));
const W0 = 4;
const RAW = W0 - 0.1 * 50;
const CUT = W0 - 0.1 * 5;

/** A step drawn above the plot, from w0 toward w1 as `a` grows, with its size over it. */
function stepBar(s: Scene, F: Frame, w0: number, w1: number, label: string, k: Ink, a: number, y: number) {
  s.alpha(Math.min(1, a * 3), () => {
    s.line(F.X(w0), F.Y(loss(w0)) - 2.5 * s.u, F.X(w0), F.Y(y), s.tint(k, 0.5), 0.25, [0.8, 0.8]);
    s.arrow(F.X(w0), F.Y(y), F.X(lerp(w0, w1, a)), F.Y(y), s.c(k), 0.55, 2.4);
    s.text(label, F.X((w0 + w1) / 2), F.Y(y) - 3.4 * s.u, { size: 3.4, font: 'mono', weight: 650, color: s.c(k), halo: true });
  });
}

const wall: SceneDef = {
  draw(s) {
    const F = frame(12 * s.u, 8 * s.u, s.w - 6 * s.u, s.h - 15 * s.u, [-1.6, 5.4], [0, 7.4]);
    axes(s, F, 'w', 'L', { x: 'blue', y: 'red' });
    xTicks(s, F, [-1, 0, 1, 2, 3, 4, 5], (x) => String(x).replace('-', '−'));
    curve(s, F, loss, -1.6, 5.4, 'purple', { upto: s.ease('wall', 1.4, 0.4), width: 0.7 });

    // The slope on the wall, read off a tangent.
    s.alpha(s.win('slope', 'thrown'), () => {
      curve(s, F, (w) => loss(W0) + 50 * (w - W0), W0 - 0.035, W0 + 0.035, '--ink-3', { width: 0.4, dash: [1.2, 0.9] });
      s.text('g = 50', F.X(W0) + 3 * s.u, F.Y(4.6), { size: 3.8, font: 'mono', weight: 650, align: 'left', color: s.c('red'), halo: true });
    });

    // The raw step: across the valley and up the far side.
    const cut = s.ease('small', 0.8);
    const fly = s.ease('thrown', 1.4, 2.2);
    s.alpha(1 - 0.75 * cut, () => {
      stepBar(s, F, W0, RAW, '−ηg = −5', 'red', s.ease('thrown', 1, 1), 6.4);
      if (fly > 0) {
        const x = lerp(W0, RAW, fly);
        const y = lerp(loss(W0), loss(RAW), fly) + 2.2 * Math.sin(Math.PI * fly);
        s.alpha(fly < 1 ? 1 : 0.85, () => ball(s, F.X(x), F.Y(y), 'red'));
        s.alpha(s.ease('thrown', 0.6, 4.5), () => s.text('higher than before', F.X(RAW) + 3 * s.u, F.Y(loss(RAW)) - 3 * s.u, { size: 3.3, font: 'mono', weight: 600, align: 'left', color: s.c('red'), halo: true }));
      }
    });

    // The cut step: half a unit, down into the valley.
    const go = s.ease('small', 1.2, 2.2);
    s.alpha(cut, () => stepBar(s, F, W0, CUT, '−η·5 = −0.5', 'green', s.ease('small', 0.8, 1), 6.4));
    const at = lerp(W0, CUT, go);
    s.alpha(s.ease('wall', 0.6, 1.6) * (go > 0 ? 1 : 1 - 0.65 * fly), () => ball(s, F.X(at), F.Y(loss(at)), go > 0 ? 'green' : 'blue'));

    cite(s, 'Tomas Mikolov, 2012', s.win('mikolov', 'small'));
    caption(s, 'the slope where the gradient explodes', 'red', s.win('slope', 'thrown'));
    caption(s, 'step = −η · g', '--ink-2', s.win('thrown', 'mikolov'));
    caption(s, 'weights overwritten, training fails', 'red', s.win('mikolov', 'cut'));
    caption(s, 'every value kept in [−15, 15]', 'green', s.win('cut', 'small'));
    caption(s, 'g cut to 5: a short step', 'green', s.win('small', 'name'));
    caption(s, 'clipping: trim what sticks out', 'green', s.ease('name', 0.6));
  },
};

// ---- the gradient as an arrow on a plane of its entries

/** The plane, and where its text goes: a column on the right on a wide stage, else rows on top. */
function layout(s: Scene): { F: Frame; px: number; ys: number[] } {
  if (s.w < 155 * s.u) {
    const L = 64 * s.u;
    const b = s.h - 5 * s.u;
    const l = (s.w - L) / 2;
    return { F: frame(l, b - L, l + L, b, [-1, 9], [-1, 9]), px: s.w / 2, ys: [6, 14.5, 23].map((y) => y * s.u) };
  }
  const l = 12 * s.u;
  const F = frame(l, 8 * s.u, l + 84 * s.u, 92 * s.u, [-1, 9], [-1, 9]);
  return { F, px: (F.r + s.w - 4 * s.u) / 2, ys: [30, 46, 62].map((y) => y * s.u) };
}

/** Grid lines at whole numbers and the two axes, named by the entry each one measures. */
function plane(s: Scene, F: Frame): void {
  clipped(s, F, () => {
    for (let i = 0; i <= 9; i++) {
      s.line(F.X(i), F.t, F.X(i), F.b, s.tint('slate', 0.14), 0.2);
      s.line(F.l, F.Y(i), F.r, F.Y(i), s.tint('slate', 0.14), 0.2);
    }
  });
  s.line(F.l, F.Y(0), F.r, F.Y(0), s.c('--axis'), 0.35);
  s.line(F.X(0), F.b, F.X(0), F.t, s.c('--axis'), 0.35);
  const o = { size: 2.8, font: 'mono', color: s.c('--ink-3'), halo: true } as const;
  s.text('g[0]', F.r - 1 * s.u, F.Y(0) + 3.2 * s.u, { ...o, align: 'right' });
  s.text('g[1]', F.X(0) + 1.5 * s.u, F.t + 2.5 * s.u, { ...o, align: 'left' });
}

/** An arrow from the origin to (x, y). */
function vector(s: Scene, F: Frame, x: number, y: number, k: Ink, width = 0.7): void {
  s.arrow(F.X(0), F.Y(0), F.X(x), F.Y(y), s.c(k), width, 3);
}

/** One line of the side text, centered on the column. */
function say(s: Scene, text: string, x: number, y: number, k: Ink, a: number): void {
  s.alpha(a, () => s.text(text, x, y, { size: 3.4, font: 'mono', color: s.c(k), halo: true }));
}

/** A line of the side text naming who did what, in the citation style. */
function who(s: Scene, text: string, x: number, y: number, a: number): void {
  s.alpha(a, () => s.text(text, x, y, { size: 3.3, italic: true, color: s.c('--ink-2'), halo: true }));
}

/** A check or a cross and its caption, centered as one line on x. */
function mark(s: Scene, ok: boolean, text: string, x: number, y: number, a: number): void {
  s.alpha(a, () => {
    const w = s.measure(text, { size: 3.3, font: 'mono' }) + 5 * s.u;
    const x0 = x - w / 2;
    s.text(ok ? '✓' : '✗', x0 + 1.6 * s.u, y, { size: 4, font: 'ui', weight: 700, color: s.c(ok ? 'green' : 'red') });
    s.text(text, x0 + 5 * s.u, y, { size: 3.3, font: 'mono', align: 'left', color: s.c('--ink-2') });
  });
}

const size: SceneDef = {
  marks: {
    f: { tex: String.raw`\lVert\symg\rVert = \sqrt{\symg \cdot \symg}`, x: 0.5, y: 0.06, size: 4.6 },
  },
  draw(s) {
    const { F, px, ys } = layout(s);
    plane(s, F);
    const k = 0.1 + 0.9 * s.ease('explode', 1.6, 0.8);
    const legs = s.ease('norm', 0.8, 3.5);
    s.alpha(legs, () => {
      s.line(F.X(0), F.Y(0), F.X(6), F.Y(0), s.c('slate'), 0.45, [1.2, 0.9]);
      s.line(F.X(6), F.Y(0), F.X(6), F.Y(8), s.c('slate'), 0.45, [1.2, 0.9]);
      const o = { size: 3.4, font: 'mono', weight: 650, color: s.c('slate'), halo: true } as const;
      s.text('6', F.X(3), F.Y(0) + 3.4 * s.u, o);
      s.text('8', F.X(6) + 2.6 * s.u, F.Y(4), o);
    });
    vector(s, F, 6 * k, 8 * k, 'red', 0.7 + 0.35 * s.win('norm', 'dot'));
    s.alpha(s.ease('explode', 0.6, 2.2), () => {
      s.text('g = [6, 8]', F.X(6) + 2 * s.u, F.Y(8), { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c('red'), halo: true });
    });
    const lab = { size: 3.6, font: 'mono', weight: 650, align: 'right', color: s.c('red'), halo: true } as const;
    s.alpha(s.ease('norm', 0.6, 1) * (1 - s.ease('norm', 0.6, 6)), () => s.text('‖g‖ = ?', F.X(3) - 2.5 * s.u, F.Y(4) - 2 * s.u, lab));
    s.alpha(s.ease('norm', 0.6, 6), () => s.text('‖g‖ = 10', F.X(3) - 2.5 * s.u, F.Y(4) - 2 * s.u, lab));
    say(s, '[0.6, 0.8] → [6, 8]', px, ys[0]!, 'red', s.win('explode', 'norm') * s.ease('explode', 0.6, 0.8));
    say(s, '‖g‖: the arrow\'s length', px, ys[0]!, '--ink-2', s.win('norm', 'dot') * s.ease('norm', 0.6, 1));
    say(s, '√(6² + 8²) = √100 = 10', px, ys[1]!, '--ink-2', s.ease('norm', 0.6, 4));
    say(s, 'g · g = 36 + 64 = 100', px, ys[2]!, '--ink-2', s.win('dot', 'three') * s.ease('dot', 0.6, 1));
    say(s, '‖[1, 2, 2]‖ = √9 = 3', px, ys[2]!, '--ink-2', s.ease('three', 0.6, 0.5));
    s.show('f', s.ease('dot', 0.6, 3), { x: px / s.w, y: ys[0]! / s.h });
  },
};

const clip: SceneDef = {
  draw(s) {
    const { F, px, ys } = layout(s);
    plane(s, F);
    const r = F.X(5) - F.X(0);
    s.alpha(s.ease('threshold', 0.8, 0.6), () => {
      clipped(s, F, () => {
        const c = s.ctx;
        c.beginPath();
        c.arc(F.X(0), F.Y(0), r, 0, Math.PI * 2);
        c.setLineDash([1.2 * s.u, 0.9 * s.u]);
        c.strokeStyle = s.c('slate');
        c.lineWidth = 0.4 * s.u;
        c.stroke();
        c.setLineDash([]);
      });
      s.text('c = 5', F.X(4.83) + 1.6 * s.u, F.Y(1.29) - 2 * s.u, { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c('slate'), halo: true });
    });

    // Cutting each entry: the box [-c, c] on both, which turns [6, 8] and misses [4, 4].
    const each = s.ease('each', 0.8, 2);
    const box = each * (1 - 0.7 * s.ease('pascanu', 0.6));
    s.alpha(box, () => {
      clipped(s, F, () => s.rrect(F.X(-5), F.Y(5), F.X(5) - F.X(-5), F.Y(-5) - F.Y(5), 0, { stroke: s.tint('orange', 0.75), lw: 0.35 }));
    });
    const turnA = s.win('turns', 'miss');
    s.alpha(turnA, () => {
      const c = s.ctx;
      const R = F.X(3.6) - F.X(0);
      c.beginPath();
      c.moveTo(F.X(0), F.Y(0));
      c.arc(F.X(0), F.Y(0), R, -Math.atan2(8, 6), -Math.PI / 4);
      c.closePath();
      c.fillStyle = s.tint('orange', 0.45);
      c.fill();
    });
    s.alpha(s.win('each', 'pascanu') * each * (1 - 0.6 * s.ease('miss', 0.6)), () => {
      vector(s, F, 5, 5, 'orange');
      s.text('[5, 5]', F.X(5) + 2 * s.u, F.Y(5) - 1.6 * s.u, { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c('orange'), halo: true });
    });
    const missA = s.win('miss', 'pascanu');
    s.alpha(missA * s.ease('miss', 0.6, 1.5), () => {
      vector(s, F, 4, 4, 'orange');
      s.text('[4, 4]', F.X(4) + 2 * s.u, F.Y(4) + 2.6 * s.u, { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c('orange'), halo: true });
    });

    // Scaling the whole arrow by c / norm: along its own line, onto the circle.
    const shrink = s.ease('scale', 1.4, 2);
    const k = 1 - 0.5 * shrink;
    s.alpha(s.ease('scale', 0.6, 2) * 0.8, () => s.line(F.X(0), F.Y(0), F.X(6.6), F.Y(8.8), s.tint('red', 0.6), 0.35, [1.2, 0.9]));
    s.alpha(1 - 0.6 * missA, () => vector(s, F, 6 * k, 8 * k, 'red', 0.7 + 0.35 * s.win('same', undefined)));
    const tip = { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c('red'), halo: true } as const;
    s.alpha((1 - shrink) * (1 - 0.6 * missA), () => s.text('[6, 8]', F.X(6) + 2 * s.u, F.Y(8), tip));
    s.alpha(shrink, () => s.text('[3, 4]', F.X(2.55) - 2.5 * s.u, F.Y(3.4), { ...tip, align: 'right' }));

    say(s, 'c = 5: the longest allowed', px, ys[0]!, 'slate', s.win('threshold', 'each'));
    say(s, 'inside: left alone', px, ys[1]!, 'slate', s.win('threshold', 'each') * s.ease('threshold', 0.6, 4));
    who(s, 'Tomas Mikolov, 2012', px, ys[0]!, s.win('each', 'pascanu'));
    say(s, 'each entry to [−5, 5]', px, ys[1]!, 'orange', s.win('each', 'miss') * s.ease('each', 0.6, 1));
    say(s, '[6, 8] → [5, 5]', px, ys[2]!, 'orange', s.win('each', 'turns') * s.ease('each', 0.6, 2));
    mark(s, false, '[5, 5]: the arrow turned', px, ys[2]!, s.win('turns', 'miss') * s.ease('turns', 0.6, 1));
    say(s, '[4, 4]: nothing cut', px, ys[1]!, 'orange', s.win('miss', 'pascanu') * s.ease('miss', 0.6, 1.5));
    mark(s, false, '‖[4, 4]‖ ≈ 5.7 > 5', px, ys[2]!, s.win('miss', 'pascanu') * s.ease('miss', 0.6, 4));
    who(s, 'Pascanu, Mikolov & Bengio, 2013', px, ys[0]!, s.ease('pascanu', 0.6));
    say(s, '‖g‖ > c: g × c / ‖g‖', px, ys[1]!, 'red', s.ease('pascanu', 0.6, 3));
    say(s, '× 5/10: [6, 8] → [3, 4]', px, ys[2]!, 'red', s.win('scale', 'same') * s.ease('scale', 0.6, 1));
    mark(s, true, 'same direction, norm 5', px, ys[2]!, s.ease('same', 0.6, 0.5));
  },
};

// ---- the step on the plane of the weights: clipped and raw landings, and the bound eta * c

const WS = [1, 2] as const;
const CL = [0.7, 1.6] as const;
const RW = [0.4, 1.2] as const;

const step: SceneDef = {
  draw(s) {
    const side = Math.min(s.h - 16 * s.u, s.w - 24 * s.u);
    const l = (s.w - side) / 2 + 4 * s.u;
    const F = frame(l, 5 * s.u, l + side, 5 * s.u + side, [0, 1.8], [0.9, 2.7]);
    clipped(s, F, () => {
      for (let i = 0; i <= 9; i++) {
        s.line(F.X(i * 0.2), F.t, F.X(i * 0.2), F.b, s.tint('slate', 0.12), 0.2);
        s.line(F.l, F.Y(0.9 + i * 0.2), F.r, F.Y(0.9 + i * 0.2), s.tint('slate', 0.12), 0.2);
      }
    });
    s.line(F.l, F.b, F.r, F.b, s.c('--axis'), 0.35);
    s.line(F.l, F.b, F.l, F.t, s.c('--axis'), 0.35);
    xTicks(s, F, [0.5, 1, 1.5]);
    yTicks(s, F, [1, 1.5, 2, 2.5]);
    const ax = { size: 3, font: 'mono', color: s.c('blue') } as const;
    s.text('w[0]', F.r, F.b + 7 * s.u, { ...ax, align: 'right' });
    s.text('w[1]', F.l + 2 * s.u, F.t + 3 * s.u, { ...ax, align: 'left' });

    // The bound: every clipped step stays within eta * c of w.
    const bound = s.ease('bound', 0.8, 1.5);
    s.alpha(bound, () => {
      const c = s.ctx;
      c.beginPath();
      c.arc(F.X(WS[0]), F.Y(WS[1]), F.X(0.5) - F.X(0), 0, Math.PI * 2);
      c.fillStyle = s.tint('green', 0.08);
      c.fill();
      c.setLineDash([1.2 * s.u, 0.9 * s.u]);
      c.strokeStyle = s.c('green');
      c.lineWidth = 0.4 * s.u;
      c.stroke();
      c.setLineDash([]);
      s.text('η c = 0.5', F.X(WS[0] + 0.36) + 1.5 * s.u, F.Y(WS[1] + 0.36) - 1.5 * s.u, { size: 3.3, font: 'mono', weight: 650, align: 'left', color: s.c('green'), halo: true });
    });

    const o = { size: 3.4, font: 'mono', weight: 650, halo: true } as const;
    // The raw step, twice as long.
    const raw = s.ease('raw', 0.8, 0.6);
    s.alpha(raw, () => {
      s.arrow(F.X(WS[0]), F.Y(WS[1]), F.X(RW[0]), F.Y(RW[1]), s.tint('red', 0.7), 0.5, 2.4);
      s.circle(F.X(RW[0]), F.Y(RW[1]), 1.5 * s.u, { fill: s.tint('red', 0.8), stroke: s.c('--card'), lw: 0.4 });
      s.text('unclipped: [0.4, 1.2]', F.X(RW[0]) + 3 * s.u, F.Y(RW[1]) + 0.3 * s.u, { ...o, align: 'left', color: s.c('red') });
    });
    // The clipped step.
    const st = s.ease('step', 0.8, 4);
    s.alpha(st, () => s.arrow(F.X(WS[0]), F.Y(WS[1]), F.X(CL[0]), F.Y(CL[1]), s.c('green'), 0.6, 2.4));
    s.alpha(st * (1 - s.ease('land', 0.6)), () => s.text('−ηg = [−0.3, −0.4]', F.X(0.85) + 3 * s.u, F.Y(1.8) + 2 * s.u, { ...o, align: 'left', color: s.c('green') }));
    const land = s.ease('land', 0.6, 1);
    s.alpha(land, () => {
      s.circle(F.X(CL[0]), F.Y(CL[1]), 1.6 * s.u, { fill: s.c('blue'), stroke: s.c('--card'), lw: 0.4 });
      s.text('[0.7, 1.6]', F.X(CL[0]) - 3 * s.u, F.Y(CL[1]), { ...o, align: 'right', color: s.c('blue') });
    });
    s.circle(F.X(WS[0]), F.Y(WS[1]), 1.6 * s.u, { fill: s.tint('blue', land > 0 ? 0.45 : 1), stroke: s.c('--card'), lw: 0.4 });
    s.text('w = [1, 2]', F.X(WS[0]) + 3 * s.u, F.Y(WS[1]) - 3 * s.u, { ...o, align: 'left', color: s.c('blue') });
    s.alpha(s.ease('step', 0.6, 2), () => s.text('η = 0.1, g = [3, 4]', F.r - 1 * s.u, F.t + 3 * s.u, { size: 3.3, font: 'mono', align: 'right', color: s.c('--ink-2'), halo: true }));
  },
};

export const scenes: Record<string, SceneDef> = { wall, size, clip, step };

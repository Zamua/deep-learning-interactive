import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp, smooth } from '../../../lecture/scene';
import type { Color } from '../../../core/symbols';
import { axes, ball, curve, frame, key, xTicks, yTicks, type Frame } from '../draw';

type Ink = Color | `--${string}`;

const KC: Color = 'teal';
const KL: Color = 'gold';
const HI = 0.1;
/** Linear and cosine decay from HI to 0, at a fraction x of the way through. */
const lin = (x: number) => HI * (1 - x);
const cosr = (x: number) => 0.5 * HI * (1 + Math.cos(Math.PI * x));

/** Eased 0 -> 1 from a fraction `f` of the way through beat `id`, so it tracks the voice at any pace. */
const after = (s: Scene, id: string, f: number, dur = 0.5) => smooth((s.t - s.at(id) - f * (s.end(id) - s.at(id))) / dur);
const mono = (s: Scene, t: string, x: number, y: number, k: Ink, align: CanvasTextAlign = 'center', size = 3.2) =>
  s.text(t, x, y, { size, font: 'mono', weight: 600, align, color: s.c(k), halo: true });

/** Who introduced an idea, and when: small, right-aligned at height y. */
function cite(s: Scene, text: string, a: number, y = 5 * s.u) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, y, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** Text in several colored runs, centered on x as one line. */
function rich(s: Scene, runs: [string, Ink][], x: number, y: number, size = 3.4) {
  const o = { size, font: 'mono' as const, weight: 600 };
  const ws = runs.map(([t]) => s.measure(t, o));
  let cur = x - ws.reduce((p, q) => p + q, 0) / 2;
  runs.forEach(([t, k], i) => {
    s.text(t, cur, y, { ...o, align: 'left', color: s.c(k), halo: true });
    cur += ws[i]!;
  });
}

/** Dashed guides from a point down to the floor and across to the wall, with a dot on it. */
function pin(s: Scene, F: Frame, x: number, y: number, a: number, k: Ink = 'slate'): void {
  s.alpha(a, () => {
    s.line(F.X(x), F.Y(y), F.X(x), F.b, s.tint('slate', 0.7), 0.3, [1, 0.8]);
    s.line(F.l, F.Y(y), F.X(x), F.Y(y), s.tint('slate', 0.7), 0.3, [1, 0.8]);
    ball(s, F.X(x), F.Y(y), k, 1.4);
  });
}

// ---- shape: linear decay, then the cosine laid over it

/** Where the top tenth of the range ends for the cosine: (1 + cos πx) / 2 = 0.9. */
const TOP_COS = Math.acos(0.8) / Math.PI;

const shape: SceneDef = {
  draw(s) {
    const u = s.u;
    const F = frame(16 * u, s.h * 0.08, s.w - 8 * u, s.h * 0.68, [0, 1], [0, 0.125]);
    const rows = [0, 1, 2].map((i) => F.b + (8 + i * 6.6) * u);
    axes(s, F, '', '', { x: '--ink-3', y: 'slate' });
    s.text('η', F.l + 2 * u, F.t + 1 * u, { size: 3.6, font: 'mono', weight: 650, align: 'left', color: s.c('slate') });
    xTicks(s, F, [0, 0.5, 1], (x) => (x === 0 ? '0' : x === 1 ? 'T' : 'T/2'));
    yTicks(s, F, [0, 0.05, 0.1]);

    // The early and late stretches, and what each wants.
    const ends = s.win('ends', 'cos');
    s.alpha(ends, () => {
      s.rrect(F.X(0), F.t, F.X(0.25) - F.X(0), F.b - F.t, 0, { fill: s.tint(KC, 0.07) });
      s.rrect(F.X(0.75), F.t, F.X(1) - F.X(0.75), F.b - F.t, 0, { fill: s.tint(KC, 0.07) });
      mono(s, 'early: stay high', F.X(0) + 1.5 * u, F.Y(0.111), '--ink-2', 'left', 3);
      s.alpha(after(s, 'ends', 0.5), () => mono(s, 'late: linger low', F.X(1) - 1.5 * u, F.Y(0.111), '--ink-2', 'right', 3));
    });

    // Where each spends time near the top and the bottom, drawn thick.
    const tm = s.ease('time', 0.8);
    s.alpha(tm, () => {
      s.rrect(F.l, F.Y(0.1), F.r - F.l, F.Y(0.09) - F.Y(0.1), 0, { fill: s.tint('slate', 0.12) });
      s.rrect(F.l, F.Y(0.01), F.r - F.l, F.Y(0) - F.Y(0.01), 0, { fill: s.tint('slate', 0.12) });
    });
    const dim = 1 - 0.55 * s.win('drops', 'time');
    s.alpha(s.ease('linear', 0.6) * dim, () => curve(s, F, lin, 0, 1, KL, { width: 0.6, upto: s.ease('linear', 2.4, 0.6) }));
    s.alpha(dim, () => curve(s, F, cosr, 0, 1, KC, { width: 0.7, upto: s.ease('cos', 2.4, 0.3) }));
    s.alpha(tm, () => {
      curve(s, F, lin, 0, 0.1, KL, { width: 1.5 });
      curve(s, F, lin, 0.9, 1, KL, { width: 1.5 });
      curve(s, F, cosr, 0, TOP_COS, KC, { width: 1.5 });
      curve(s, F, cosr, 1 - TOP_COS, 1, KC, { width: 1.5 });
      ball(s, F.X(0.5), F.Y(0.05), 'slate', 1.3);
      mono(s, 'both 0.05', F.X(0.5) + 2.5 * u, F.Y(0.05) - 2.5 * u, 'slate', 'left', 3);
    });

    // Evenly spaced samples, and each one's drop to the next, the linear ones just left of the cosine's.
    const dr = s.win('drops', 'time');
    s.alpha(dr, () => {
      for (let i = 0; i < 8; i++) {
        const [a, b] = [i / 8, (i + 1) / 8];
        const on = after(s, 'drops', 0.15 + i * 0.06);
        s.alpha(on, () => {
          s.line(F.X(b) - 1.1 * u, F.Y(lin(a)), F.X(b) - 1.1 * u, F.Y(lin(b)), s.c(KL), 0.9);
          s.line(F.X(b) + 1.1 * u, F.Y(cosr(a)), F.X(b) + 1.1 * u, F.Y(cosr(b)), s.c(KC), 0.9);
        });
      }
      for (let i = 0; i <= 8; i++) {
        ball(s, F.X(i / 8), F.Y(lin(i / 8)), KL, 0.8);
        ball(s, F.X(i / 8), F.Y(cosr(i / 8)), KC, 0.8);
      }
    });

    // The rates at the ends, then a legend once both curves are up.
    s.alpha(s.win('linear', 'ends'), () => {
      mono(s, 'ηₘₐₓ', F.X(0) + 2.5 * u, F.Y(0.1) - 3 * u, 'slate', 'left', 3.2);
      mono(s, 'ηₘᵢₙ', F.X(1) - 1 * u, F.Y(0.026), 'slate', 'right', 3.2);
    });
    s.alpha(s.ease('cos', 0.6), () => {
      const x = key(s, F.X(0.42), F.Y(0.117), KL, 'linear', 3);
      key(s, x, F.Y(0.117), KC, 'cosine', 3);
    });

    s.alpha(s.win('linear', 'ends'), () => rich(s, [['the same drop every step', KL]], s.w / 2, rows[0]!));
    s.alpha(s.win('ends', 'cos'), () => {
      rich(s, [['early: big steps, fast progress', '--ink-2']], s.w / 2, rows[0]!);
      rich(s, [['late: small steps settle in', '--ink-2']], s.w / 2, rows[1]!);
    });
    s.alpha(s.win('cos', 'drops'), () => rich(s, [['cosine: ', KC], ['slow, then fast, then slow', '--ink-2']], s.w / 2, rows[0]!));
    s.alpha(s.win('drops', 'time'), () => {
      rich(s, [['linear drops: ', KL], ['all the same', '--ink-2']], s.w / 2, rows[0]!);
      rich(s, [['cosine drops: ', KC], ['small, big, small', '--ink-2']], s.w / 2, rows[1]!);
    });
    s.alpha(tm, () => {
      rich(s, [['in the top tenth: ', '--ink-2'], ['linear 10%', KL], [', ', '--ink-2'], ['cosine 20%', KC]], s.w / 2, rows[0]!, 3.2);
      rich(s, [['and the same at the bottom', '--ink-2']], s.w / 2, rows[1]!, 3.2);
    });
  },
};

// ---- circle: the cosine is the height of a point going around a circle

const ANG = [Math.PI / 3, Math.PI / 2, (3 * Math.PI) / 4];
const ANG_LABEL = ['T/3: 0.5', 'T/2: 0', '3T/4: −0.71'];

const circle: SceneDef = {
  draw(s) {
    const u = s.u;
    const R = Math.min(s.w / 4.8, s.h * 0.3);
    const cx = 6 * u + R;
    const cy = s.h * 0.04 + 1.15 * R + 2 * u;
    const x0 = cx + R + 12 * u;
    const x1 = s.w - 8 * u;
    const GX = (th: number) => x0 + (th / Math.PI) * (x1 - x0);
    const GY = (v: number) => cy - v * R;
    const P = (th: number) => [cx + R * Math.sin(th), cy - R * Math.cos(th)] as const;
    const rows = [0, 1, 2].map((i) => cy + 1.15 * R + (10.5 + i * 6.6) * u);

    // The circle, its center line carried across to the graph as height zero.
    s.circle(cx, cy, R, { stroke: s.c('--axis'), lw: 0.4 });
    s.line(cx - R - 2 * u, cy, x1, cy, s.c('--axis'), 0.3);
    s.line(x0, GY(1.15), x0, GY(-1.15), s.c('--axis'), 0.3);
    ball(s, cx, cy, '--ink-3', 0.6);

    // The point: at the top, then half a turn as the voice walks it down.
    const th = Math.PI * s.prog('height');
    const sweepDone = s.since('height') > 0;
    // The distance travelled, along the circle.
    const pi = s.win('pi', 'vals');
    s.alpha(Math.max(0.35, pi), () => {
      if (th > 0.01) {
        s.ctx.beginPath();
        s.ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + th);
        s.ctx.strokeStyle = s.c(pi > 0.5 ? 'gold' : KC);
        s.ctx.lineWidth = (0.6 + 0.6 * pi) * u;
        s.ctx.stroke();
      }
    });
    s.alpha(pi, () => mono(s, 'π', cx + R + 2.5 * u, cy + 4.5 * u, 'gold', 'left', 4.4));

    const [px, py] = P(th);
    s.line(px, cy, px, py, s.c(KC), 0.6);
    s.line(px, py, GX(th), py, s.tint(KC, 0.6), 0.3, [1, 0.8]);
    // The traced height, against the angle turned.
    if (th > 0.01) {
      s.ctx.beginPath();
      for (let i = 0; i <= 80; i++) {
        const a = (th * i) / 80;
        if (i) s.ctx.lineTo(GX(a), GY(Math.cos(a)));
        else s.ctx.moveTo(GX(a), GY(Math.cos(a)));
      }
      s.ctx.strokeStyle = s.c(KC);
      s.ctx.lineWidth = 0.7 * u;
      s.ctx.stroke();
    }
    ball(s, GX(th), py, KC, 1.1);
    ball(s, px, py, KC, 1.5);
    // Which way it goes.
    s.alpha(s.win('circle', 'height'), () => {
      s.ctx.beginPath();
      s.ctx.arc(cx, cy, R + 3 * u, -Math.PI / 2 + 0.15, -Math.PI / 2 + 0.75);
      s.ctx.strokeStyle = s.c('--ink-3');
      s.ctx.lineWidth = 0.35 * u;
      s.ctx.stroke();
      const e = -Math.PI / 2 + 0.75;
      const [ex, ey] = [cx + (R + 3 * u) * Math.cos(e), cy + (R + 3 * u) * Math.sin(e)];
      s.arrow(ex - 0.6 * u * Math.sin(e), ey + 0.6 * u * Math.cos(e), ex + 0.4 * u * -Math.sin(e), ey + 0.4 * u * Math.cos(e), s.c('--ink-3'), 0.35, 2);
      mono(s, 'height', px + 2 * u, (cy + py) / 2, KC, 'left', 3);
    });

    // Flat, steep, flat, as the trace passes.
    const lab = (a: number, t: string, x: number, y: number, align: CanvasTextAlign) => s.alpha(a * (1 - s.ease('cos', 0.5)), () => mono(s, t, x, y, '--ink-2', align, 3));
    lab(after(s, 'height', 0.2), 'flat', GX(0.12 * Math.PI), GY(1) - 3.2 * u, 'center');
    lab(after(s, 'height', 0.5), 'steepest', GX(Math.PI / 2) + 2.5 * u, GY(0) - 2.5 * u, 'left');
    lab(after(s, 'height', 0.82), 'flat', GX(0.88 * Math.PI), GY(-1) + 3.4 * u, 'center');

    // Tick values, then the axis relabelled from angle to steps.
    const cosA = s.ease('cos', 0.6);
    s.alpha(cosA * (1 - s.ease('vals', 0.5)), () => mono(s, 'cos', GX(0.3 * Math.PI) + 1.5 * u, GY(Math.cos(0.3 * Math.PI)) + 3.5 * u, KC, 'right', 3.4));
    s.alpha(cosA, () => {
      for (const v of [1, 0, -1]) s.text(String(v).replace('-', '−'), x0 - 1.6 * u, GY(v), { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
    });
    const ticks = (a: number, l: string, r: string) => s.alpha(a, () => {
      s.text(l, x0, GY(-1.15) + 3.2 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
      s.text(r, x1, GY(-1.15) + 3.2 * u, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
    });
    const steps = s.ease('tT', 0.6);
    ticks(s.ease('pi', 0.6) * (1 - steps), '0', 'π');
    ticks(steps, 't = 0', 't = T');

    // Three places along the way.
    ANG.forEach((a, i) => {
      s.alpha(after(s, 'vals', [0.05, 0.35, 0.62][i]!), () => {
        const [qx, qy] = P(a);
        s.line(qx, qy, GX(a), qy, s.tint('gold', 0.7), 0.3, [1, 0.8]);
        ball(s, qx, qy, 'gold', 1.1);
        ball(s, GX(a), GY(Math.cos(a)), 'gold', 1.2);
      });
    });

    // Text under the picture.
    const r0 = rows[0]!;
    const r1 = rows[1]!;
    s.alpha(s.win('circle', 'cos'), () => rich(s, [['a point on a circle of radius 1', '--ink-2']], s.w / 2, r0));
    s.alpha(s.win('cos', 'pi'), () => rich(s, [['its height = ', '--ink-2'], ['cos', KC], ['(angle turned)', '--ink-2']], s.w / 2, r0));
    s.alpha(s.win('pi', 'tT'), () => rich(s, [['half a turn = ', '--ink-2'], ['π ≈ 3.14', 'gold']], s.w / 2, r0));
    s.alpha(s.win('tT', 'vals'), () => {
      rich(s, [['step t of T: angle ', '--ink-2'], ['πt/T', 'gold']], s.w / 2, r0);
      rich(s, [['height ', '--ink-2'], ['cos(πt/T)', KC]], s.w / 2, r1);
    });
    s.alpha(s.ease('vals', 0.6), () => {
      ANG_LABEL.forEach((t, i) => s.alpha(after(s, 'vals', [0.05, 0.35, 0.62][i]!), () => {
        const x = s.w / 2 + (i - 1) * (s.tall ? 30 : 34) * u;
        mono(s, t, x, r0, 'gold', 'center', 3.2);
      }));
    });
  },
};

// ---- fit: the cosine, raised and halved, then stretched across the rates

/** The curve at x = t / T: the cosine, morphing into (1 + cos) / 2 as `m` goes 0 to 1. */
const shapeAt = (x: number, m: number) => lerp(Math.cos(Math.PI * x), (1 + Math.cos(Math.PI * x)) / 2, m);
const MARKS = [0, 1 / 3, 0.5, 0.75, 1];
const COS_LABEL = ['1', '0.5', '0', '−0.71', '−1'];
const HALF_LABEL = ['1', '0.75', '0.5', '0.15', '0'];
const RATE_LABEL = ['0.1', '0.075', '0.05', '0.015', '0'];
const third = (x: number) => (x === 1 ? 'T' : x === 0.5 ? 'T/2' : x === 0.75 ? '3T/4' : 'T/3');

const fit: SceneDef = {
  marks: {
    h: { tex: String.raw`\tfrac{1}{2}\big(1 + \cos(\pi t / T)\big)`, x: 0.5, y: 0.09, size: 5 },
    f: { tex: String.raw`\symeta_t = \symeta_{\min} + \tfrac{1}{2}(\symeta_{\max} - \symeta_{\min})\left(1 + \cos\tfrac{\pi t}{T}\right)`, x: 0.5, y: 0.08, size: 3.9 },
    ends: { tex: String.raw`\symeta_{\max} = 0.1,\quad \symeta_{\min} = 0`, x: 0.5, y: 0.17, size: 3.8 },
    at2: { tex: String.raw`t = T/2{:}\quad 0.05 \times (1 + 0) = 0.05`, x: 0.5, y: 0.17, size: 3.8 },
    at3: { tex: String.raw`t = T/3{:}\quad 0.05 \times (1 + 0.5) = 0.075`, x: 0.5, y: 0.17, size: 3.8 },
  },
  draw(s) {
    const u = s.u;
    const m = s.ease('halve', 1.2, 0.3);
    const sc = s.ease('gap', 1.2, 0.3);
    s.show('h', s.ease('halve', 0.6, 0.5) * (1 - s.ease('gap', 0.5)));
    s.show('f', s.ease('gap', 0.6));
    s.show('ends', after(s, 'gap', 0.6) * (1 - s.ease('half', 0.4)));
    s.show('at2', after(s, 'half', 0.5) * (1 - s.ease('third', 0.4)));
    s.show('at3', after(s, 'third', 0.4) * (1 - s.ease('history', 0.4)));
    const F = frame(16 * u, s.h * 0.24, s.w - 12 * u, s.h - 9 * u, [0, 1], [lerp(-1.15, -0.06, sc), lerp(1.15, 1.12, sc)]);
    axes(s, F, '', '', { x: '--ink-3', y: 'slate' });
    s.line(F.l, F.Y(0), F.r, F.Y(0), s.c('--axis'), 0.3);
    xTicks(s, F, [1 / 3, 0.5, 0.75, 1], third);
    s.alpha(1 - m, () => yTicks(s, F, [-1, 0, 1], (y) => String(y).replace('-', '−')));
    s.alpha(m * (1 - sc), () => yTicks(s, F, [0.5, 1]));
    s.alpha(sc, () => yTicks(s, F, [0.5, 1], (y) => String(y / 10)));
    // The straight line, for comparison once the curve runs from 1 to 0.
    s.alpha(m, () => {
      curve(s, F, (x) => 1 - x, 0, 1, KL, { width: 0.35, dash: [1.2, 1] });
      mono(s, 'linear', F.X(0.66), F.Y(0.34) - 3.5 * u, KL, 'left', 3);
    });
    curve(s, F, (x) => shapeAt(x, m), 0, 1, KC, { width: 0.7 });
    const hot = [0, s.ease('third', 0.6) * (1 - s.ease('history', 0.5)), s.win('half', 'third'), 0, 0];
    MARKS.forEach((x, i) => {
      const y = shapeAt(x, m);
      const big = hot[i]!;
      if (big > 0.01) pin(s, F, x, y, big, 'gold');
      ball(s, F.X(x), F.Y(y), KC, 1.2 + 0.5 * big);
      const dy = i === 0 ? 3.4 : -3;
      const at = (t: string, a: number) => s.alpha(a, () => mono(s, t, F.X(x) + 2.2 * u, F.Y(y) + dy * u, big > 0.5 ? 'gold' : '--ink', 'left'));
      at(COS_LABEL[i]!, 1 - m);
      at(HALF_LABEL[i]!, m * (1 - sc));
      at(RATE_LABEL[i]!, sc);
    });
    // A third of the way in, the straight line is already lower.
    s.alpha(after(s, 'third', 0.7) * (1 - s.ease('history', 0.5)), () => {
      ball(s, F.X(1 / 3), F.Y(2 / 3), KL, 1.2);
      mono(s, 'linear: 0.067', F.X(1 / 3) - 2 * u, F.Y(2 / 3) + 3.4 * u, KL, 'right', 3);
    });
    cite(s, 'SGDR · Loshchilov & Hutter, 2016', s.ease('history', 0.6), s.h * 0.17);
    s.alpha(s.ease('anneal', 0.6), () => mono(s, 'annealing: cooling slowly', F.X(0.97), F.Y(0.95), '--ink-2', 'right', 3.2));
  },
};

// ---- warm: a warmup, then the cosine over the next T steps

const K = 1000;
const T = 2000;
const LO = 0.01;
const warm = (t: number) => (t < K ? (HI * t) / K : LO + 0.5 * (HI - LO) * (1 + Math.cos((Math.PI * (t - K)) / T)));
const k1 = (t: number) => (t === 0 ? '0' : `${t / 1000}k`);

const warmScene: SceneDef = {
  draw(s) {
    const u = s.u;
    const F = frame(16 * u, s.h * 0.08, s.w - 7 * u, s.h * 0.66, [0, K + T], [0, 0.12]);
    const rows = [0, 1, 2].map((i) => F.b + (8 + i * 6.6) * u);
    axes(s, F, 'step', 'η', { x: '--ink-3', y: 'slate' });
    xTicks(s, F, [1000, 2500], k1);
    yTicks(s, F, [0.01, 0.05, 0.1]);
    s.alpha(s.ease('both', 0.6, 1), () => s.line(F.l, F.Y(LO), F.r, F.Y(LO), s.tint('slate', 0.5), 0.3, [1, 0.8]));
    curve(s, F, warm, 0, K + T, KC, { width: 0.7, upto: s.ease('both', 2.4, 0.3) });
    s.alpha(s.ease('both', 0.6, 1), () => {
      s.line(F.X(K), F.t, F.X(K), F.b, s.tint('gold', 0.6), 0.3, [1.2, 1]);
      mono(s, 'warmup', F.X(450), F.Y(0.105), '--ink-2');
    });
    s.alpha(s.ease('both', 0.6, 1) * (1 - after(s, 'ex', 0.5)), () => mono(s, 'k', F.X(K) + 1.5 * u, F.Y(0.112), 'gold', 'left'));
    s.alpha(after(s, 'both', 0.5) * (1 - after(s, 'ex', 0.5)), () => mono(s, 'cosine over the next T', F.X(2050), F.Y(0.112), '--ink-2'));
    s.alpha(after(s, 'ex', 0.55), () => {
      const y = F.Y(0.106);
      s.arrow(F.X(K), y, F.X(2500), y, s.c('gold'), 0.35, 1.4);
      mono(s, '1,500 = 3T/4', F.X(1750), y - 3 * u, 'gold');
    });
    pin(s, F, 2500, warm(2500), after(s, 'c', 0.1), 'gold');
    s.alpha(after(s, 'add', 0.5), () => mono(s, '≈ 0.0232', F.X(2500) + 2.5 * u, F.Y(warm(2500)) - 3 * u, 'gold', 'left', 3.4));

    s.alpha(s.win('both', 'ex'), () => rich(s, [['t counts from the end of the warmup', '--ink-2']], s.w / 2, rows[0]!));
    s.alpha(s.win('ex', 'c'), () => rich(s, [['k = 1,000   T = 2,000   ', '--ink-2'], ['0.1 → 0.01', 'slate']], s.w / 2, rows[0]!));
    s.alpha(s.ease('c', 0.6), () => rich(s, [['cos(π · 3/4) ≈ −0.707   1 + cos ≈ ', '--ink-2'], ['0.293', KC]], s.w / 2, rows[0]!, 3.2));
    s.alpha(s.ease('gap', 0.6), () => rich(s, [['½(0.1 − 0.01) = 0.045,  × 0.293 ≈ ', '--ink-2'], ['0.0132', KC]], s.w / 2, rows[1]!, 3.2));
    s.alpha(s.ease('add', 0.6), () => rich(s, [['0.01 + 0.0132 ≈ ', '--ink-2'], ['0.0232', 'gold']], s.w / 2, rows[2]!, 3.4));
  },
};

export const scenes: Record<string, SceneDef> = { shape, circle, fit, warm: warmScene };

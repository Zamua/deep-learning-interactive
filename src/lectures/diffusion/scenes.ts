import { fmt } from '../../core/code';
import type { Color } from '../../core/symbols';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { DATA, EPS, EX, FOLLOW, GRID, GRID_PTS, GUIDE, GUIDE_W, LINES, RUNS, SCHED, SNAPS, T, TRAIN_LOSS, WALK40, fieldAt, noised } from './data';
import { Frame, type K, type Rect, area, at, fit, hatX0, pair, pill, split, tails } from './kit';

const WIDE: [number, number, number, number] = [-3, 3, -2.2, 2.2];
const MOON: [number, number, number, number] = [-2.6, 2.6, -1.85, 1.85];
const buf = new Float32Array(DATA.n * 2);
const buf400 = new Float32Array(800);
const buf300 = new Float32Array(600);
const TRACK = [0, 7, 19, 33, 48, 61, 77, 95, 120, 151];

const step = (t: number) => Math.round(Math.max(0, Math.min(T, t)));
const sqrtAb = (t: number) => Math.sqrt(SCHED.ab[step(t)]!);
const sqrt1mAb = (t: number) => Math.sqrt(1 - SCHED.ab[step(t)]!);
const epsOf = (i: number): [number, number] => [EPS[2 * i]!, EPS[2 * i + 1]!];
type FitOpts = Parameters<typeof fit>[5];

/** Stage fractions for a point inside a rect, for positioning marks. */
function frac(s: Scene, r: Rect, fx: number, fy: number): { x: number; y: number } {
  return { x: (r[0] + r[2] * fx) / s.w, y: (r[1] + r[3] * fy) / s.h };
}

/** Text placed by fractions of a panel, shrunk to fit its width. */
function panelText(s: Scene, r: Rect, text: string, fx: number, fy: number, o: FitOpts = {}): void {
  fit(s, text, r[0] + r[2] * fx, r[1] + r[3] * fy, r[2] - s.u * 4, { size: 3.6, font: 'ui', color: s.c('--ink-2'), ...o });
}

/** The moons in faint orange, the backdrop of most plots. */
function backdrop(fr: Frame, a = 0.2): void {
  fr.dots(DATA.X, fr.s.tint('orange', a), 0.55);
}

/** A label inside the top of a rect. */
function heading(s: Scene, r: Rect, text: string, a = 1, k: K = '--ink-2'): void {
  s.alpha(a, () => fit(s, text, r[0] + r[2] / 2, r[1] + s.u * 4, r[2] - s.u * 6, { size: 3.6, font: 'ui', weight: 600, color: s.c(k), halo: true }));
}

/** A mono readout in the top-right corner of a plot, on a card so lines never cross it. */
function corner(s: Scene, r: Rect, text: string): void {
  const u = s.u;
  const w = Math.min(s.measure(text, { size: 3.6, font: 'mono' }), r[2] - u * 6);
  s.rrect(r[0] + r[2] - u * 4.5 - w, r[1] + u * 1.4, w + u * 3, u * 5.2, 1.2, { fill: s.tint('--card', 0.92) });
  fit(s, text, r[0] + r[2] - u * 3, r[1] + u * 4.1, r[2] - u * 6, { size: 3.6, font: 'mono', align: 'right' });
}

/** A symbol label (x₀, xₜ, ε) next to a plotted point. */
function tag(s: Scene, text: string, x: number, y: number, k: K, align: CanvasTextAlign = 'left', size = 3.8): void {
  s.text(text, x, y, { size, font: 'ui', weight: 650, color: s.c(k), align, halo: true });
}

/** The followed point's last few forward steps, fading with age. */
function walkTail(s: Scene, fr: Frame, upto: number, tail = 14): void {
  const k = Math.floor(upto);
  for (let q = k, age = 0; q > Math.max(0, k - tail); q--, age++) {
    const [ax, ay] = FOLLOW.walk[q]!;
    const [bx, by] = FOLLOW.walk[q - 1]!;
    const a = 1 - age / tail;
    fr.path([ax, bx], [ay, by], s.tint('--card', 0.9 * a), 1.1);
    fr.path([ax, bx], [ay, by], s.tint('purple', a), 0.45);
  }
  fr.dot(FOLLOW.walk[0]![0], FOLLOW.walk[0]![1], 1.3, s.c('orange'));
  const p = FOLLOW.walk[k]!;
  fr.dot(p[0], p[1], 1.6, s.c('purple'));
}

/** A small chart of the two closed-form weights over t, with a marker at `t`. */
function weightChart(s: Scene, r: Rect, t: number, a = 1): void {
  const [x, y, w, h] = r;
  const pad = s.u * 3;
  const X = (v: number) => x + pad + ((w - 2 * pad) * v) / T;
  const Y = (v: number) => y + h - pad * 1.4 - (h - pad * 2.8) * v;
  s.alpha(a, () => {
    s.rrect(x, y, w, h, 1.6, { fill: s.tint('--paper', 0.5), stroke: s.c('--rule'), lw: 0.25 });
    s.line(X(0), Y(0), X(T), Y(0), s.c('--grid'), 0.3);
    s.line(X(0), Y(1), X(T), Y(1), s.c('--grid'), 0.3, [1, 1]);
    const curve = (f: (k: number) => number, k: Color) => {
      const c = s.ctx;
      c.beginPath();
      for (let i = 0; i <= T; i++) (i ? c.lineTo : c.moveTo).call(c, X(i), Y(f(i)));
      c.strokeStyle = s.c(k);
      c.lineWidth = 0.6 * s.u;
      c.stroke();
    };
    curve(sqrtAb, 'slate');
    curve(sqrt1mAb, 'teal');
    s.text('noise weight', X(62), Y(0.74), { size: 3.4, font: 'ui', weight: 650, color: s.c('teal'), align: 'left', halo: true });
    s.text('signal weight', X(62), Y(0.26), { size: 3.4, font: 'ui', weight: 650, color: s.c('slate'), align: 'left', halo: true });
    s.line(X(t), Y(-0.02), X(t), Y(1.04), s.c('purple'), 0.4);
    s.circle(X(t), Y(sqrtAb(t)), s.u * 1, { fill: s.c('slate') });
    s.circle(X(t), Y(sqrt1mAb(t)), s.u * 1, { fill: s.c('teal') });
    const left = t > 50;
    s.text(`t = ${Math.round(t)}`, X(t) + (left ? -1.5 : 1.5) * s.u, Y(0.5), { size: 3.4, font: 'mono', color: s.c('purple'), align: left ? 'right' : 'left', halo: true });
  });
}

// ---------------------------------------------------------------- intro

const intro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    s.alpha(s.win('hello', 'idea'), () => {
      s.text('Diffusion models', w / 2, h * 0.4, { size: 10, font: 'display', weight: 600 });
      s.text('noise in, data out', w / 2, h * 0.53, { size: 4.8, italic: true, color: s.c('--ink-2') });
      s.alpha(s.ease('recall', 0.6), () => {
        pill(s, '2016: GANs, sharp but unstable', w / 2, h * 0.68, 'slate', 3.6);
        s.alpha(s.ease('recall', 0.6, 2.2), () => pill(s, 'since 2022: diffusion', w / 2, h * 0.8, 'purple', 3.6));
      });
    });
    const pa = s.ease('idea', 0.7) * (1 - 0.8 * s.ease('plan', 0.6));
    if (pa > 0) {
      const r = area(s, 0.13);
      const fr = new Frame(s, r, WIDE);
      s.alpha(pa, () => {
        fr.card();
        backdrop(fr, 0.16);
        let label = '';
        if (s.since('chain') < 0) {
          const t = 100 * smooth(s.prog('destroy') * 1.1);
          noised(t, buf);
          fr.dots(buf, t < 0.5 ? s.c('orange') : s.tint('purple', 0.75), 0.75);
          label = s.since('destroy') < 0 ? 'the data: two moons' : s.since('undo') < 0 ? `adding noise: t = ${Math.round(t)}` : 'learn to undo one small step';
        } else {
          const frames = RUNS.ddpm.frames;
          const head = Math.min(frames.length - 1, 100 * smooth(s.prog('chain') * 1.15));
          at(frames, head, buf400);
          const fade = clamp01((100 - head) / 8);
          tails(fr, frames, head, TRACK, (a) => s.tint('purple', 0.5 * a * fade), 12);
          fr.dots(buf400, s.tint('purple', 0.85), 0.8);
          label = s.since('toy') < 0 ? `removing noise: t = ${100 - Math.round(head)}` : '1,000 points, 2 numbers each';
        }
        fit(s, label, r[0] + r[2] / 2, r[1] + u * 5, r[2] - u * 8, { size: 4, font: 'ui', weight: 600, color: s.c('--ink-2'), halo: true });
        if (s.since('undo') >= 0 && s.since('chain') < 0) {
          s.alpha(s.ease('undo', 0.6), () => {
            const cx = r[0] + r[2] / 2, cy = r[1] + r[3] - u * 7;
            s.arrow(cx + u * 14, cy, cx - u * 14, cy, s.c('blue'), 0.7, 3);
            s.text('a network', cx, cy - u * 4, { size: 3.6, font: 'ui', weight: 600, color: s.c('blue'), halo: true });
          });
        }
      });
    }
    const plan = s.ease('plan', 0.6);
    if (plan > 0) {
      const items: [string, K][] = [
        ['forward process', 'slate'],
        ['training loss', 'red'],
        ['sampling', 'purple'],
        ['the score', 'blue'],
        ['guidance', 'gold'],
        ['latent diffusion', 'green'],
        ['flow matching', 'teal'],
      ];
      const cols = w / h < 1.2 ? 2 : 3;
      const rows = Math.ceil(items.length / cols);
      const cw = (w - u * 12) / cols;
      const rh = u * 9;
      const x0 = u * 6 + cw / 2;
      const y0 = h * 0.56 - ((rows - 1) * rh) / 2;
      items.forEach(([name, k], i) => {
        const a = plan * clamp01(s.prog('plan') * items.length * 1.2 - i + 0.6);
        s.alpha(a, () => pill(s, `${i + 1}. ${name}`, x0 + (i % cols) * cw, y0 + Math.floor(i / cols) * rh, k, 3.8, 0.16));
      });
    }
  },
};

// ---------------------------------------------------------------- forward

const forward: SceneDef = {
  marks: {
    step: { tex: String.raw`\symxt = \sqrt{1-\symbeta}\;\sym{xt}{x_{t-1}} + \sqrt{\symbeta}\;\symeps`, x: 0.5, y: 0.8, size: 4.4 },
  },
  draw(s) {
    const { u } = s;
    const { main, side } = split(s, 0.6);
    const t = s.since('walk') < 0 ? 0 : s.since('end') < 0 ? 25 * smooth(s.prog('walk') * 1.2) : 25 + 75 * smooth(s.prog('end') * 1.2);
    s.slot('t', Math.round(t));
    const fr = new Frame(s, main, WIDE);
    fr.card();
    backdrop(fr, 0.16);
    noised(t, buf);
    fr.dots(buf, t < 0.5 ? s.c('orange') : s.tint('purple', 0.7), 0.7);
    s.alpha(s.ease('walk', 0.5), () => walkTail(s, fr, t));
    corner(s, main, `t = ${Math.round(t)}`);
    const [sx, sy, sw, sh] = side;
    const sched = s.win('schedule', 'step');
    if (sched > 0) {
      s.alpha(sched, () => {
        const bx = sx + sw * 0.12, bw = sw * 0.76, by = sy + sh * 0.26, bh = sh * 0.48;
        const grow = smooth(s.prog('schedule') * 1.5);
        s.ctx.fillStyle = s.tint('green', 0.65);
        for (let k = 1; k <= T; k++) {
          const v = SCHED.beta[k]! / 0.2;
          s.ctx.fillRect(bx + ((k - 1) / T) * bw, by + bh - bh * v * grow, bw / T - 0.4, bh * v * grow);
        }
        panelText(s, side, 'βₜ: the noise variance added at step t', 0.5, 0.1, { weight: 600, color: s.c('green') });
        s.text('t = 1', bx, by + bh + u * 3.5, { size: 3.3, font: 'mono', color: s.c('--ink-3'), align: 'left' });
        s.text('t = 100', bx + bw, by + bh + u * 3.5, { size: 3.3, font: 'mono', color: s.c('--ink-3'), align: 'right' });
        s.text('0.001', bx, by + bh - u * 3, { size: 3.3, font: 'mono', color: s.c('green'), align: 'left' });
        s.text('0.2', bx + bw + u * 1.5, by + u * 1, { size: 3.3, font: 'mono', color: s.c('green'), align: 'left' });
      });
    }
    s.show('step', s.win('step', 'why'), frac(s, side, 0.5, 0.45));
    const varA = s.win('why', 'end');
    if (varA > 0) {
      s.alpha(varA, () => {
        const bw = Math.min(sw * 0.12, u * 10);
        const base = sy + sh * 0.84, H = sh * 0.62;
        const bx1 = sx + sw * 0.32 - bw / 2, bx2 = sx + sw * 0.62 - bw / 2;
        s.rrect(bx1, base - H, bw, H, 0.8, { fill: s.tint('slate', 0.55) });
        s.text('before', bx1 + bw / 2, base + u * 3.5, { size: 3.3, font: 'ui', color: s.c('--ink-3') });
        s.text('1', bx1 + bw / 2, base - H / 2, { size: 4, font: 'mono', weight: 650, color: '#fff' });
        const p = s.prog('var');
        const beta = 0.2;
        const keep = lerp(1, 1 - beta, smooth(p / 0.35));
        const add = beta * smooth((p - 0.45) / 0.3);
        s.rrect(bx2, base - H * keep, bw, H * keep, 0.8, { fill: s.tint('slate', 0.55) });
        if (add > 0.001) s.rrect(bx2, base - H * (keep + add), bw, H * add, 0.8, { fill: s.tint('teal', 0.75) });
        s.text('after', bx2 + bw / 2, base + u * 3.5, { size: 3.3, font: 'ui', color: s.c('--ink-3') });
        s.text('1 − β', bx2 + bw + u * 1.5, base - (H * keep) / 2, { size: 3.4, font: 'mono', color: s.c('slate'), align: 'left' });
        s.alpha(smooth((p - 0.5) / 0.2), () => s.text('+ β', bx2 + bw + u * 1.5, base - H * (keep + add / 2), { size: 3.4, font: 'mono', color: s.c('teal'), align: 'left' }));
        s.alpha(s.ease('var', 0.5, 0.2), () => s.text('variance, with β = 0.2', sx + sw * 0.47, sy + sh * 0.1, { size: 3.4, font: 'ui', weight: 600, color: s.c('--ink-2') }));
      });
    }
    s.alpha(s.win('end', 'numbers'), () => {
      panelText(s, side, 'every point is now just', 0.5, 0.36);
      panelText(s, side, 'a draw from N(0, I)', 0.5, 0.58, { size: 4.6, font: 'serif', italic: true, weight: 600, color: s.c('purple') });
    });
    s.alpha(s.ease('numbers', 0.6), () => {
      panelText(s, side, 'DDPM:  T = 1000,  β from 0.0001 to 0.02', 0.5, 0.36, { font: 'mono', color: s.c('--ink') });
      panelText(s, side, 'here:  T = 100,  β from 0.001 to 0.2', 0.5, 0.58, { font: 'mono', color: s.c('purple') });
    });
  },
};

// ---------------------------------------------------------------- closed form

const closed: SceneDef = {
  marks: {
    alpha: { tex: String.raw`\symalpha = 1 - \symbeta`, x: 0.5, y: 0.7, size: 4.2 },
    abar: { tex: String.raw`\symab = \sym{alpha}{\alpha_1}\,\sym{alpha}{\alpha_2}\cdots\symalpha`, x: 0.5, y: 0.8, size: 4.2 },
    m1: { tex: String.raw`\sqrt{\alpha_2}\big(\sqrt{\alpha_1}\,x_0 + \sqrt{1-\alpha_1}\,\epsilon_1\big) + \sqrt{1-\alpha_2}\,\epsilon_2`, x: 0.5, y: 0.7, size: 3.6 },
    m2: { tex: String.raw`= \sqrt{\alpha_1\alpha_2}\,x_0 + \sqrt{1-\alpha_1\alpha_2}\;\epsilon`, x: 0.5, y: 0.8, size: 3.6 },
    closed: { tex: String.raw`\symxt = \sqrt{\symab}\;\sym{x0}{x_0} + \sqrt{1-\symab}\;\symeps`, x: 0.5, y: 0.8, size: 4.2 },
    warn: { tex: String.raw`\text{DDIM's } \alpha_t \;=\; \text{DDPM's } \bar\alpha_t`, x: 0.5, y: 0.45, size: 4.6 },
  },
  draw(s) {
    const { u } = s;
    const sameA = s.win('same', 'warn');
    const warnA = s.ease('warn', 0.6);
    const chartOn = s.since('curves') >= 0;
    const { main, side } = split(s, chartOn ? 0.5 : 0.6);
    let t = 0;
    if (chartOn && s.since('arc') < 0) t = 100 * smooth(s.prog('curves') * 1.2);
    else if (s.since('arc') >= 0) t = 40 + 60 * smooth(s.prog('arc') * 1.1);
    else if (s.since('closed') >= 0) t = 40;
    const fr = new Frame(s, main, WIDE);
    s.alpha((1 - sameA) * (1 - warnA), () => {
      fr.card();
      backdrop(fr, 0.16);
      const slowA = s.win('slow', 'alpha');
      if (slowA > 0) {
        const k = Math.max(1, Math.floor(100 * clamp01(s.prog('slow') * 1.2)));
        fr.dots(DATA.X, s.c('orange'), 0.7);
        s.alpha(slowA, () => {
          walkTail(s, fr, k);
          heading(s, main, `small step ${k} of 100…`);
        });
      } else {
        noised(t, buf);
        fr.dots(buf, t < 0.5 ? s.c('orange') : s.tint('purple', 0.7), 0.7);
        const arcA = s.ease('arc', 0.6);
        if (arcA > 0) {
          s.alpha(arcA, () => {
            const i = FOLLOW.i;
            const [ex, ey] = epsOf(i);
            const xs: number[] = [], ys: number[] = [];
            for (let k = 0; k <= T; k++) {
              xs.push(sqrtAb(k) * DATA.X[2 * i]! + sqrt1mAb(k) * ex);
              ys.push(sqrtAb(k) * DATA.X[2 * i + 1]! + sqrt1mAb(k) * ey);
            }
            fr.path(xs, ys, s.tint('purple', 0.35), 0.45);
            fr.path(xs.slice(0, step(t) + 1), ys.slice(0, step(t) + 1), s.c('purple'), 0.65);
            fr.dot(xs[0]!, ys[0]!, 1.4, s.c('orange'));
            fr.dot(xs[T]!, ys[T]!, 1.4, s.c('teal'));
            fr.dot(xs[step(t)]!, ys[step(t)]!, 1.7, s.c('purple'));
            tag(s, 'x₀', fr.X(xs[0]!) - u * 2.5, fr.Y(ys[0]!) + u * 1, 'orange', 'right');
            tag(s, 'ε', fr.X(xs[T]!) + u * 2.5, fr.Y(ys[T]!), 'teal');
          });
        }
        if (s.since('closed') >= 0) corner(s, main, `t = ${Math.round(t)}`);
      }
    });
    s.show('alpha', s.win('alpha', 'merge') * s.ease('alpha', 0.6), frac(s, side, 0.5, 0.3));
    s.show('abar', s.win('abar', 'merge') * s.ease('abar', 0.6), frac(s, side, 0.5, 0.65));
    s.show('m1', s.win('merge', 'closed') * s.ease('merge', 0.6, 1.2), frac(s, side, 0.5, 0.3));
    s.show('m2', s.win('merge', 'closed') * s.ease('merge', 0.6, 3.2), frac(s, side, 0.5, 0.65));
    s.show('closed', s.win('closed', 'same'), frac(s, side, 0.5, chartOn ? 0.1 : 0.45));
    if (chartOn) weightChart(s, [side[0], side[1] + side[3] * 0.24, side[2], side[3] * 0.76], t, s.win('curves', 'same'));
    if (sameA > 0) {
      s.alpha(sameA * (1 - warnA), () => {
        const [r1, r2] = pair(s);
        const f1 = new Frame(s, r1, WIDE);
        const f2 = new Frame(s, r2, WIDE);
        f1.card();
        f2.card();
        backdrop(f1, 0.14);
        backdrop(f2, 0.14);
        f1.dots(WALK40, s.tint('purple', 0.7), 0.6);
        f2.dots(noised(40, buf), s.tint('purple', 0.7), 0.6);
        heading(s, r1, '40 small steps');
        heading(s, r2, 'one jump to t = 40');
      });
    }
    if (warnA > 0) {
      s.show('warn', warnA, { x: 0.5, y: 0.44 });
      s.alpha(warnA, () => fit(s, 'same idea, different letters: always check', s.w / 2, s.h * 0.6, s.w - u * 10, { size: 3.8, font: 'ui', color: s.c('--ink-2') }));
    }
    s.slot('t', Math.round(t));
    s.slot('a', fmt(sqrtAb(t), 3));
    s.slot('b', fmt(sqrt1mAb(t), 3));
  },
};

// ---------------------------------------------------------------- loss

const loss: SceneDef = {
  marks: {
    goal: { tex: String.raw`\symepsth(\symxt, t) \approx \symeps`, x: 0.5, y: 0.8, size: 5 },
    loss: { tex: String.raw`\symL = \big\lVert \symeps - \symepsth(\symxt, t) \big\rVert^2`, x: 0.5, y: 0.8, size: 4.4 },
    hat: { tex: String.raw`\sym{x0}{\hat{x}_0} = \big(\symxt - \sqrt{1-\symab}\,\symepsth\big) / \sqrt{\symab}`, x: 0.5, y: 0.8, size: 4 },
  },
  draw(s) {
    const { u } = s;
    const { main, side } = split(s, 0.58);
    const fr = new Frame(s, main, [-2.2, 2.6, -1.7, 1.7]);
    const { x0, e, xt, ep, hat, a, b } = EX;
    fr.card();
    backdrop(fr, 0.22);
    s.alpha(s.ease('pick', 0.5), () => {
      fr.dot(x0[0], x0[1], 1.6, s.c('orange'));
      tag(s, 'x₀', fr.X(x0[0]) - u * 2.5, fr.Y(x0[1]), 'orange', 'right');
    });
    const noiseA = s.ease('noise', 0.6);
    const mixA = s.ease('mix', 0.8);
    if (noiseA > 0) {
      // The jump formula as vectors: shrink x0, then add the scaled noise.
      const px = lerp(x0[0], a * x0[0], mixA), py = lerp(x0[1], a * x0[1], mixA);
      s.alpha(noiseA, () => {
        s.alpha(mixA, () => fr.path([x0[0], px], [x0[1], py], s.tint('orange', 0.6), 0.35, [1, 1]));
        fr.arrow(px, py, px + b * e[0], py + b * e[1], s.c('teal'), 0.6);
        tag(s, `${fmt(b, 2)} ε`, fr.X(px + b * e[0] * 0.55) + u * 2, fr.Y(py + b * e[1] * 0.55), 'teal', 'left', 3.4);
      });
      s.alpha(mixA, () => {
        fr.dot(xt[0], xt[1], 1.6, s.c('purple'));
        tag(s, 'xₜ', fr.X(xt[0]) + u * 2.5, fr.Y(xt[1]) - u * 1.5, 'purple');
      });
    }
    s.alpha(s.ease('why', 0.6, 0.8), () => {
      fr.path([xt[0], hat[0]], [xt[1], hat[1]], s.c('orange'), 0.4, [1.2, 1]);
      s.circle(fr.X(hat[0]), fr.Y(hat[1]), u * 1.9, { stroke: s.c('orange'), lw: 0.5 });
      hatX0(s, fr.X(hat[0]) - u * 8, fr.Y(hat[1]) - u * 1, 3.8, s.c('orange'));
    });
    // Side panel.
    const [sx, sy, sw, sh] = side;
    const goalA = s.win('ddpm', 'pick');
    s.show('goal', goalA, frac(s, side, 0.5, 0.3));
    s.alpha(goalA, () => {
      panelText(s, side, 'guess the noise that was mixed in', 0.5, 0.58);
      panelText(s, side, 'Ho, Jain and Abbeel (2020)', 0.5, 0.78, { color: s.c('--ink-3') });
    });
    s.alpha(s.win('t', 'ask'), () => {
      panelText(s, side, `t = ${EX.t}`, 0.5, 0.3, { size: 4.6, font: 'mono', weight: 650, color: s.c('--ink') });
      panelText(s, side, `x₀ shrinks to ${fmt(a, 2)} of itself; the noise gets weight ${fmt(b, 2)}`, 0.5, 0.56);
    });
    const netA = s.win('ask', 'none');
    if (netA > 0) {
      s.alpha(netA, () => {
        const bw = Math.min(sw * 0.3, u * 24), bh = Math.min(sh * 0.36, u * 12);
        const bx = sx + sw * 0.06, by = sy + sh * 0.12;
        s.rrect(bx, by, bw, bh, 2, { fill: s.tint('blue', 0.1), stroke: s.c('blue'), lw: 0.5 });
        fit(s, 'the network', bx + bw / 2, by + bh * 0.4, bw - u * 2, { size: 3.6, font: 'ui', weight: 650, color: s.c('blue') });
        fit(s, 'sees xₜ and t', bx + bw / 2, by + bh * 0.72, bw - u * 2, { size: 3.2, font: 'ui', color: s.c('--ink-3') });
        const sc = Math.min(sw * 0.16, sh * 0.34);
        const ox = sx + sw * 0.58, oy = sy + sh * 0.5;
        s.line(ox - sc * 0.2, oy, ox + sc * 1.2, oy, s.c('--grid'), 0.25);
        s.line(ox, oy + sc * 0.2, ox, oy - sc * 1.2, s.c('--grid'), 0.25);
        s.arrow(ox, oy, ox + sc * e[0], oy - sc * e[1], s.c('teal'), 0.6, 2.4);
        tag(s, 'true ε', ox + sc * e[0] + u * 2, oy - sc * e[1] - u * 1, 'teal', 'left', 3.4);
        s.alpha(s.ease('ask', 0.6, 1.2), () => {
          s.arrow(ox, oy, ox + sc * ep[0], oy - sc * ep[1], s.c('blue'), 0.6, 2.4);
          tag(s, 'guess', ox + sc * ep[0] + u * 2, oy - sc * ep[1] + u * 3, 'blue', 'left', 3.4);
        });
        const errA = s.ease('err', 0.6);
        s.alpha(errA, () => {
          s.line(ox + sc * e[0], oy - sc * e[1], ox + sc * ep[0], oy - sc * ep[1], s.c('red'), 0.7);
          tag(s, `error² = ${fmt(EX.loss, 2)}`, ox - u * 2, oy + u * 4, 'red', 'right', 3.4);
        });
        s.show('loss', errA, frac(s, side, 0.5, 0.88));
      });
    }
    const cmpA = s.win('none', 'why');
    if (cmpA > 0) {
      s.alpha(cmpA, () => {
        const rows: [string, string, K][] = [
          ['GAN', 'two networks in a game', 'slate'],
          ['VAE', 'reconstruction + KL penalty', 'slate'],
          ['diffusion', 'one squared error', 'red'],
        ];
        rows.forEach(([n, d, k], i) => {
          const y = sy + sh * (0.16 + 0.2 * i);
          s.text(n, sx + sw * 0.08, y, { size: 3.7, font: 'ui', weight: 650, color: s.c(k), align: 'left' });
          fit(s, d, sx + sw * 0.34, y, sw * 0.62, { size: 3.5, font: 'ui', color: s.c('--ink-2'), align: 'left' });
        });
        s.alpha(s.ease('base', 0.6), () => panelText(s, side, 'always guessing 0 gives loss = 1', 0.5, 0.82, { font: 'mono', color: s.c('--ink'), weight: 600 }));
      });
    }
    const whyA = s.ease('why', 0.6);
    if (whyA > 0) {
      s.show('hat', whyA, frac(s, side, 0.5, 0.14));
      const pts: [string, string][] = [
        ['scale', 'ε has the same size at every step'],
        ['resid', 'at low noise: report the small difference'],
      ];
      pts.forEach(([id, text], i) => {
        s.alpha(s.ease(id, 0.6), () => {
          const y = sy + sh * (0.46 + 0.22 * i);
          s.circle(sx + sw * 0.06, y, u * 1.1, { fill: s.c('blue') });
          fit(s, text, sx + sw * 0.1, y, sw * 0.86, { size: 3.5, font: 'ui', color: s.c('--ink'), align: 'left' });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- training

const SNAP_AT: [string, number, number][] = [
  ['snap1', 30, 0],
  ['snap2', 100, 0],
  ['snap3', 300, 0],
  ['snap3', 3000, 0.55],
];

const training: SceneDef = {
  draw(s) {
    const { u } = s;
    const { main, side } = split(s, 0.55);
    const netA = s.win('net', 'snap1');
    const sampA = s.ease('snap1', 0.6);
    if (netA > 0) {
      s.alpha(netA, () => {
        const [x, y, w, h] = main;
        const layers: [string, K][] = [
          ['26', 'orange'],
          ['64', 'slate'],
          ['64', 'slate'],
          ['64', 'slate'],
          ['2', 'blue'],
        ];
        const cx = (i: number) => x + w * (0.2 + (0.55 * i) / (layers.length - 1));
        const span = Math.min(h * 0.52, u * 36);
        const cy = y + h * 0.52;
        const rowsOf = (i: number) => (i === 0 ? 7 : i === layers.length - 1 ? 2 : 8);
        const yOf = (i: number, r: number) => cy - span / 2 + (span * (r + 0.5)) / rowsOf(i);
        for (let i = 0; i + 1 < layers.length; i++)
          for (let r = 0; r < rowsOf(i); r++) for (let q = 0; q < rowsOf(i + 1); q++) s.line(cx(i), yOf(i, r), cx(i + 1), yOf(i + 1, q), s.tint('--ink', 0.06), 0.2);
        layers.forEach(([n, k], i) => {
          for (let r = 0; r < rowsOf(i); r++) s.circle(cx(i), yOf(i, r), u * 1.3, { fill: s.tint(k, 0.7), stroke: s.c('--card'), lw: 0.2 });
          s.text(n, cx(i), cy + span / 2 + u * 4, { size: 3.5, font: 'mono', weight: 600, color: s.c(k) });
        });
        fit(s, 'noise guess', cx(4) + u * 3, cy, x + w - cx(4) - u * 4, { size: 3.4, font: 'ui', weight: 600, color: s.c('blue'), align: 'left' });
        const inp = s.since('inputs') >= 0;
        fit(s, inp ? 'each input as sines and cosines at a few frequencies' : 'in: the noisy point and the step number', x + w / 2, y + u * 4, w - u * 6, { size: 3.6, font: 'ui', weight: 600, color: s.c(inp ? 'orange' : 'purple') });
      });
    }
    const curveA = s.ease('train', 0.6);
    if (curveA > 0) {
      s.alpha(curveA, () => {
        const [x, y, w, h] = side;
        const pad = u * 4;
        const L = TRAIN_LOSS.loss;
        const n = L.length;
        const X = (i: number) => x + pad + ((w - 2 * pad) * i) / (n - 1);
        const Y = (v: number) => y + h - pad - ((h - 2.4 * pad) * Math.min(v, 1.15)) / 1.15;
        s.rrect(x, y, w, h, 1.6, { fill: s.tint('--paper', 0.5), stroke: s.c('--rule'), lw: 0.25 });
        s.line(X(0), Y(1), X(n - 1), Y(1), s.c('--ink-3'), 0.25, [1, 1]);
        s.text('always guessing 0', X(n - 1), Y(1) - u * 2.4, { size: 3.2, font: 'ui', color: s.c('--ink-3'), align: 'right' });
        s.line(X(0), Y(0), X(n - 1), Y(0), s.c('--grid'), 0.3);
        const shown = Math.max(2, Math.round(n * smooth(s.span('train', 'snap1') * 1.05)));
        const c = s.ctx;
        c.beginPath();
        for (let i = 0; i < shown; i++) (i ? c.lineTo : c.moveTo).call(c, X(i), Y(L[i]!));
        c.strokeStyle = s.c('red');
        c.lineWidth = 0.55 * u;
        c.stroke();
        s.text('loss', X(0) + u * 2, Y(1) + u * 3.5, { size: 3.5, font: 'ui', weight: 650, color: s.c('red'), align: 'left' });
        s.text('step 0', X(0), y + h - u * 1.4, { size: 3.1, font: 'mono', color: s.c('--ink-3'), align: 'left' });
        s.text('3,000', X(n - 1), y + h - u * 1.4, { size: 3.1, font: 'mono', color: s.c('--ink-3'), align: 'right' });
        s.alpha(s.ease('snap1', 0.5), () => {
          for (const [id, st, delay] of SNAP_AT) {
            if (s.since(id) < delay * (s.end(id) - s.at(id))) continue;
            const i = Math.min(n - 1, Math.round(st / TRAIN_LOSS.every));
            s.circle(X(i), Y(L[i]!), u * 1.2, { fill: s.c('purple'), stroke: s.c('--card'), lw: 0.3 });
          }
        });
        if (s.since('snap1') < 0) {
          const st = Math.round(3000 * smooth(s.span('train', 'snap1') * 1.05));
          s.slot('step', st);
          s.slot('loss', fmt(L[Math.min(n - 1, Math.round(st / TRAIN_LOSS.every))]!, 3));
        }
        s.alpha(s.ease('browser', 0.6), () => pill(s, 'the whole run: under a minute', x + w / 2, Y(0.55), 'purple', 3.4, 0.15));
      });
    }
    if (sampA > 0) {
      let st = 30;
      for (const [id, k, delay] of SNAP_AT) if (s.since(id) >= delay * (s.end(id) - s.at(id))) st = k;
      const snap = SNAPS.find((q) => q.step === st) ?? SNAPS[SNAPS.length - 1]!;
      s.slot('step', st);
      s.slot('loss', fmt(TRAIN_LOSS.loss[Math.min(TRAIN_LOSS.loss.length - 1, Math.round(st / TRAIN_LOSS.every))]!, 3));
      s.alpha(sampA, () => {
        const fr = new Frame(s, main, MOON);
        fr.card();
        backdrop(fr, 0.25);
        fr.dots(snap.pts, s.tint('purple', 0.85), 0.75);
        heading(s, main, `samples after ${st.toLocaleString()} training steps`);
      });
    }
  },
};

// ---------------------------------------------------------------- sampling

const sampling: SceneDef = {
  marks: {
    ddpm: { tex: String.raw`\sym{xt}{x_{t-1}} = \frac{1}{\sqrt{\symalpha}}\Big(\symxt - \frac{\symbeta}{\sqrt{1-\symab}}\,\symepsth\Big) + \sigma_t z`, x: 0.5, y: 0.8, size: 4 },
  },
  draw(s) {
    const { u } = s;
    const { main, side } = split(s, 0.6);
    const fr = new Frame(s, main, WIDE);
    fr.card();
    backdrop(fr, 0.16);
    const quiet = s.since('nonoise') >= 0;
    const run = quiet ? RUNS.quiet : RUNS.ddpm;
    let head: number;
    if (!quiet) head = s.since('watch') < 0 ? 0 : s.since('mean') < 0 ? 100 * (0.72 * smooth(s.prog('watch')) + 0.28 * smooth(s.prog('late'))) : 100;
    else head = 100 * clamp01((s.t - s.at('nonoise') - 1.2) / Math.max(1, s.end('collapse') - s.at('nonoise') - 2.5));
    head = Math.min(head, run.frames.length - 1);
    at(run.frames, head, buf400);
    tails(fr, run.frames, head, TRACK, (a) => s.tint('purple', 0.5 * a * clamp01((100 - head) / 8)), 12);
    fr.dots(buf400, s.tint('purple', 0.85), 0.8);
    const tNow = run.times[Math.min(Math.round(head), run.times.length - 1)] ?? 100;
    s.slot('t', tNow);
    corner(s, main, `${quiet ? 'no fresh noise' : 'DDPM'}   t = ${tNow}`);
    const [sx, sy, sw, sh] = side;
    s.show('ddpm', s.win('each', 'watch') + s.win('mean', 'nonoise'), frac(s, side, 0.5, 0.18));
    const parts: [string, string, K][] = [
      ['remove', 'remove this step\'s share of the predicted noise', 'blue'],
      ['unshrink', 'divide by √αₜ to undo the shrink', 'green'],
      ['fresh', 'add fresh noise σₜ z', 'teal'],
    ];
    parts.forEach(([id, text, k], i) => {
      s.alpha(s.ease(id, 0.5) * (1 - s.ease('watch', 0.5)), () => {
        const y = sy + sh * (0.5 + 0.17 * i);
        s.circle(sx + sw * 0.05, y, u * 1.1, { fill: s.c(k) });
        fit(s, text, sx + sw * 0.05 + u * 3, y, sw * 0.9, { size: 3.5, font: 'ui', color: s.c('--ink'), align: 'left' });
      });
    });
    s.alpha(s.win('start', 'each'), () => {
      panelText(s, side, 'start from pure noise', 0.5, 0.35, { size: 4, weight: 600, color: s.c('purple') });
      panelText(s, side, 't = 100: every point a draw from N(0, I)', 0.5, 0.58, { font: 'mono' });
    });
    s.alpha(s.win('watch', 'mean'), () => {
      const p = clamp01(head / 100);
      const bx = sx + sw * 0.1, bw = sw * 0.8, by = sy + sh * 0.45;
      s.rrect(bx, by, bw, u * 2.4, 1.2, { fill: s.tint('--ink', 0.06) });
      s.rrect(bx, by, Math.max(u * 2.4, bw * p), u * 2.4, 1.2, { fill: s.tint('purple', 0.7) });
      panelText(s, side, `${Math.round(head)} of 100 steps`, 0.5, 0.72, { font: 'mono' });
    });
    s.alpha(s.ease('nonoise', 0.6), () => {
      panelText(s, side, 'same network, same start, no σₜ z', 0.5, 0.35, { weight: 600, color: s.c('red') });
      s.alpha(s.ease('collapse', 0.6, 0.8), () => panelText(s, side, 'everything collapses to one spot', 0.5, 0.6, { size: 3.8, weight: 600, color: s.c('--ink') }));
    });
  },
};

// ---------------------------------------------------------------- DDIM

/** The point used to show one DDIM step: far enough from its x0 guess that both are legible. */
function ddimExample(): { q: number; j: number } | null {
  const run = RUNS.ddim5;
  const q = 2;
  if (run.frames.length <= q + 1) return null;
  const t = run.times[q]!;
  const a = Math.sqrt(SCHED.ab[t]!), b = Math.sqrt(1 - SCHED.ab[t]!);
  const F = run.frames[q]!, E = run.eps[q]!;
  let best = -1, bd = 0;
  for (let j = 0; j < run.n; j++) {
    const x = F[2 * j]!, y = F[2 * j + 1]!;
    const hx = (x - b * E[2 * j]!) / a, hy = (y - b * E[2 * j + 1]!) / a;
    const d = Math.hypot(hx - x, hy - y);
    if (Math.abs(x) < 2.2 && Math.abs(y) < 1.6 && Math.abs(hx) < 2 && Math.abs(hy) < 1.3 && y > 0.3 && d < 1.4 && d > bd) {
      bd = d;
      best = j;
    }
  }
  return best < 0 ? null : { q, j: best };
}

const ddim: SceneDef = {
  marks: {
    h1: { tex: String.raw`\sym{x0}{\hat{x}_0} = \big(\symxt - \sqrt{1-\symab}\,\symepsth\big) / \sqrt{\symab}`, x: 0.5, y: 0.75, size: 3.9 },
    h2: { tex: String.raw`\sym{xt}{x_{t'}} = \sqrt{\sym{ab}{\bar\alpha_{t'}}}\;\sym{x0}{\hat{x}_0} + \sqrt{1-\sym{ab}{\bar\alpha_{t'}}}\;\symepsth`, x: 0.5, y: 0.85, size: 3.9 },
  },
  draw(s) {
    const { u } = s;
    const { main, side } = split(s, 0.6);
    const fr = new Frame(s, main, WIDE);
    fr.card();
    backdrop(fr, 0.16);
    let k = 20;
    if (s.since('guess') < 0) {
      fr.dots(RUNS.ddpm.last, s.tint('purple', 0.85), 0.8);
      corner(s, main, `DDPM: ${RUNS.ddpm.frames.length - 1} network calls`);
      s.alpha(s.ease('ddim', 0.6), () => {
        panelText(s, side, 'DDIM', 0.5, 0.3, { size: 7, font: 'display', weight: 600, color: s.c('purple') });
        panelText(s, side, 'Song, Meng and Ermon (2020): the same trained network', 0.5, 0.65);
      });
    } else if (s.since('det') < 0) {
      const ex = ddimExample();
      if (ex) {
        const run = RUNS.ddim5;
        const { q, j } = ex;
        const t = run.times[q]!, tn = run.times[q + 1]!;
        const F = run.frames, E = run.eps[q]!;
        const x = F[q]![2 * j]!, y = F[q]![2 * j + 1]!;
        const a = Math.sqrt(SCHED.ab[t]!), b = Math.sqrt(1 - SCHED.ab[t]!);
        const hx = (x - b * E[2 * j]!) / a, hy = (y - b * E[2 * j + 1]!) / a;
        const nx = F[q + 1]![2 * j]!, ny = F[q + 1]![2 * j + 1]!;
        fr.dots(F[q]!, s.tint('purple', 0.25), 0.6);
        fr.dot(x, y, 1.6, s.c('purple'));
        tag(s, `xₜ at t = ${t}`, fr.X(x) + u * 2.5, fr.Y(y) - u * 3, 'purple', 'left', 3.4);
        const ga = s.ease('guess', 0.8, 0.8);
        s.alpha(ga, () => {
          fr.path([x, lerp(x, hx, ga)], [y, lerp(y, hy, ga)], s.c('orange'), 0.45, [1.2, 1]);
          s.circle(fr.X(hx), fr.Y(hy), u * 1.8, { stroke: s.c('orange'), lw: 0.5 });
          hatX0(s, fr.X(hx) + u * 3, fr.Y(hy) + u * 4.5, 3.8, s.c('orange'));
        });
        const ra = s.ease('renoise', 0.8, 0.8);
        s.alpha(ra, () => {
          fr.arrow(hx, hy, lerp(hx, nx, ra), lerp(hy, ny, ra), s.c('teal'), 0.5, 2.2);
          fr.dot(nx, ny, 1.5, s.c('purple'));
          tag(s, `now at t′ = ${tn}`, fr.X(nx) - u * 2.5, fr.Y(ny) + u * 1.2, 'purple', 'right', 3.4);
        });
      }
      s.alpha(s.win('guess', 'renoise'), () => panelText(s, side, '1. the clean point the noise guess implies', 0.5, 0.3, { color: s.c('orange'), weight: 600 }));
      s.alpha(s.ease('renoise', 0.6), () => panelText(s, side, '2. re-noise it, to a lower level, with the same guess', 0.5, 0.3, { color: s.c('teal'), weight: 600 }));
      s.show('h1', s.ease('guess', 0.6), frac(s, side, 0.5, 0.58));
      s.show('h2', s.ease('renoise', 0.6), frac(s, side, 0.5, 0.84));
    } else {
      const five = s.since('five') >= 0;
      const run = five ? RUNS.ddim5 : RUNS.ddim20;
      k = five ? 5 : 20;
      const total = run.total;
      const p = five ? smooth(s.prog('five') * 1.4) : s.since('skip') < 0 ? 0 : smooth(s.span('skip', 'five') * 1.1);
      const head = Math.min(run.frames.length - 1, total * p);
      at(run.frames, head, buf400);
      tails(fr, run.frames, head, TRACK, (a) => s.tint('purple', 0.55 * (0.4 + 0.6 * a)), total, 0.35);
      fr.dots(buf400, s.tint('purple', 0.85), 0.8);
      corner(s, main, `DDIM: call ${Math.min(Math.floor(head), total)} of ${total}`);
      s.alpha(s.win('det', 'five'), () => {
        panelText(s, side, 'no fresh noise: the same start always gives the same result', 0.5, 0.3);
        s.alpha(s.ease('skip', 0.6), () => panelText(s, side, '20 network calls instead of 100', 0.5, 0.6, { size: 4, font: 'mono', weight: 600, color: s.c('purple') }));
      });
      s.alpha(s.ease('five', 0.6), () => {
        panelText(s, side, '5 calls: each jump is too long', 0.5, 0.3, { size: 4, weight: 600, color: s.c('purple') });
        panelText(s, side, 'to follow a curved path', 0.5, 0.55);
      });
    }
    s.slot('k', k);
  },
};

// ---------------------------------------------------------------- score

const fieldBuf = new Float32Array(GRID_PTS.length);

const score: SceneDef = {
  marks: {
    score: { tex: String.raw`\nabla_{\symxt}\log p_t(\symxt) \approx -\frac{\symepsth(\symxt, t)}{\sqrt{1-\symab}}`, x: 0.5, y: 0.2, size: 4.4 },
  },
  draw(s) {
    const { w, u } = s;
    const r = area(s, 0.13);
    const fr = new Frame(s, r, MOON);
    fr.card();
    backdrop(fr, 0.35);
    let t = 50;
    if (s.since('far') >= 0) t = 50 + 35 * smooth(s.prog('far') * 1.5);
    if (s.since('near') >= 0) t = 85 - 75 * smooth(s.prog('near') * 1.2);
    if (s.since('name') >= 0) t = 10;
    if (s.since('follow') >= 0) t = 100 - 92 * smooth(s.prog('follow'));
    s.slot('t', Math.round(t));
    const E = fieldAt(t, fieldBuf);
    const flip = s.ease('flip', 1.2, 0.4);
    const fa = s.ease('what', 0.8) * (1 - 0.55 * s.win('name', 'follow') - 0.4 * s.ease('follow', 0.6));
    if (E) {
      const sp = (GRID.x1 - GRID.x0) / (GRID.nx - 1);
      s.alpha(fa, () => {
        for (let q = 0; q < GRID.nx * GRID.ny; q++) {
          const x = GRID_PTS[2 * q]!, y = GRID_PTS[2 * q + 1]!;
          const ex = E[2 * q]!, ey = E[2 * q + 1]!;
          const m = Math.hypot(ex, ey) || 1e-9;
          const L = sp * (0.3 + 0.55 * Math.min(1, m / 1.6));
          const ang = Math.atan2(ey, ex) + Math.PI * flip;
          fr.arrow(x, y, x + Math.cos(ang) * L, y + Math.sin(ang) * L, s.tint('blue', 0.8), 0.4, 1.8);
        }
      });
    }
    const lbl = s.since('flip') < 0 ? 'arrows: the predicted noise' : 'arrows: the predicted noise, flipped';
    const lt = `${lbl}    t = ${Math.round(t)}`;
    const lw = Math.min(s.measure(lt, { size: 3.5, font: 'mono' }), r[2] - u * 6);
    s.rrect(r[0] + r[2] - u * 4.5 - lw, r[1] + r[3] - u * 6.5, lw + u * 3, u * 5, 1.2, { fill: s.tint('--card', 0.92) });
    fit(s, lt, r[0] + r[2] - u * 3, r[1] + r[3] - u * 3.8, r[2] - u * 6, { size: 3.5, font: 'mono', align: 'right', color: s.c('blue') });
    if (s.since('follow') >= 0) {
      const run = RUNS.ddim20;
      at(run.frames, Math.min(run.frames.length - 1, (run.total * (100 - t)) / 100), buf400);
      fr.dots(buf400, s.tint('purple', 0.85), 0.75);
    }
    const mA = s.win('name', 'history');
    if (mA > 0) {
      const my = r[1] + u * 9;
      s.alpha(mA, () => s.rrect(w / 2 - u * 30, my - u * 6.5, u * 60, u * 13, 2, { fill: s.c('--card'), stroke: s.c('--rule'), lw: 0.25 }));
      s.show('score', mA, { x: 0.5, y: my / s.h });
    }
    s.alpha(s.win('history', 'follow'), () => {
      pill(s, '2019: Song and Ermon learn scores at many noise levels', w / 2, r[1] + r[3] * 0.16, 'blue', 3.4, 0.18);
      s.alpha(s.ease('history', 0.6, 3), () => pill(s, '2021: both views are one continuous process (an SDE)', w / 2, r[1] + r[3] * 0.3, 'purple', 3.4, 0.18));
    });
  },
};

// ---------------------------------------------------------------- guidance

const MOON_K = ['blue', 'gold'] as const;

const guidance: SceneDef = {
  marks: {
    cfg: { tex: String.raw`\tilde\epsilon = \symepsth(\varnothing) + \symw\,\big(\symepsth(\symc) - \symepsth(\varnothing)\big)`, x: 0.5, y: 0.8, size: 4 },
  },
  draw(s) {
    const { u } = s;
    const { main, side } = split(s, 0.6);
    const fr = new Frame(s, main, MOON);
    fr.card();
    const showSamples = s.since('w0') >= 0;
    const wi = s.since('w4') >= 0 ? 2 : s.since('w1') >= 0 ? 1 : 0;
    const beatId = ['w0', 'w1', 'w4'][wi]!;
    for (let c = 0; c < 2; c++) {
      const pts: number[] = [];
      for (let j = 0; j < DATA.n; j++) if (DATA.y[j] === c) pts.push(DATA.X[2 * j]!, DATA.X[2 * j + 1]!);
      fr.dots(pts, s.tint(MOON_K[c]!, showSamples ? 0.14 : 0.6), showSamples ? 0.55 : 0.7);
    }
    if (!showSamples) {
      s.alpha(s.ease('cond', 0.6), () => {
        s.text('c = 0', fr.X(-1.5), fr.Y(1.25), { size: 4, font: 'mono', weight: 650, color: s.c('blue'), halo: true });
        s.text('c = 1', fr.X(1.6), fr.Y(-1.2), { size: 4, font: 'mono', weight: 650, color: s.c('gold'), halo: true });
      });
    } else {
      const p = smooth((s.t - s.at(beatId)) / 2.2);
      for (let c = 0; c < 2; c++) {
        const run = GUIDE[wi]![c]!;
        const out = new Float32Array(run.n * 2);
        at(run.frames, Math.min(run.frames.length - 1, run.total * p), out);
        fr.dots(out, s.tint(MOON_K[c]!, 0.9), 0.85);
      }
      s.text(`w = ${GUIDE_W[wi]}`, main[0] + main[2] - u * 3, main[1] + main[3] - u * 4, { size: 5, font: 'mono', weight: 650, align: 'right', color: s.c('red'), halo: true });
    }
    s.slot('w', showSamples ? GUIDE_W[wi]! : 1);
    const [sx, sy, sw, sh] = side;
    s.alpha(s.win('drop', 'twice'), () => {
      const labels = ['0', '1', '1', '∅', '0', '1', '0', '0', '∅', '1'];
      const cw = Math.min(sw / 11, u * 7);
      const x0 = sx + sw / 2 - (labels.length * cw) / 2;
      panelText(s, side, 'training labels, 1 in 5 hidden (∅)', 0.5, 0.22);
      labels.forEach((l, i) => {
        const k: K = l === '∅' ? '--ink-3' : l === '0' ? 'blue' : 'gold';
        s.cell(x0 + i * cw, sy + sh * 0.42, cw * 0.9, cw * 0.9, l, k, { on: l === '∅' ? 1 : 0, size: 3.6 });
      });
    });
    s.alpha(s.win('twice', 'w0'), () => {
      const sc = Math.min(sw * 0.2, sh * 0.34);
      const ox = sx + sw * 0.12, oy = sy + sh * 0.62;
      const eu: [number, number] = [1, 0.3];
      const ec: [number, number] = [1.35, 0.75];
      const gw = 2.5;
      const et: [number, number] = [eu[0] + gw * (ec[0] - eu[0]), eu[1] + gw * (ec[1] - eu[1])];
      const P = (v: [number, number]): [number, number] => [ox + sc * v[0], oy - sc * v[1]];
      s.arrow(ox, oy, ...P(eu), s.c('slate'), 0.6, 2.4);
      tag(s, 'no label', P(eu)[0] + u * 2, P(eu)[1] + u * 2.5, 'slate', 'left', 3.3);
      s.arrow(ox, oy, ...P(ec), s.c('gold'), 0.6, 2.4);
      tag(s, 'label c', P(ec)[0] - u * 1, P(ec)[1] - u * 2.5, 'gold', 'right', 3.3);
      const pa = s.ease('push', 0.9, 1);
      s.alpha(pa, () => {
        const tip = P([lerp(ec[0], et[0], pa), lerp(ec[1], et[1], pa)]);
        s.line(...P(ec), ...tip, s.tint('red', 0.6), 0.35, [1, 1]);
        s.arrow(ox, oy, ...tip, s.c('red'), 0.6, 2.4);
        tag(s, `w = ${gw}`, tip[0] + u * 2, tip[1], 'red', 'left', 3.3);
      });
    });
    s.show('cfg', s.win('push', 'w0'), frac(s, side, 0.62, 0.86));
    s.alpha(s.win('w0', 'trade'), () => panelText(s, side, ['the label is ignored', 'plain conditioning', 'pushed past the label'][wi]!, 0.5, 0.45, { size: 3.8, weight: 600 }));
    s.alpha(s.ease('trade', 0.6), () => {
      panelText(s, side, 'faithful to c: up.  diverse: down.', 0.5, 0.32, { size: 3.8, weight: 600, color: s.c('--ink') });
      panelText(s, side, 'Stable Diffusion\'s default scale: 7.5', 0.5, 0.6, { font: 'mono', color: s.c('--ink-3') });
    });
  },
};

// ---------------------------------------------------------------- latent

function picture(s: Scene, x: number, y: number, size: number): void {
  const c = s.ctx;
  const g = c.createLinearGradient(0, y, 0, y + size);
  g.addColorStop(0, '#7fb2ec');
  g.addColorStop(0.6, '#cfe3f7');
  g.addColorStop(0.61, '#5f9e4f');
  g.addColorStop(1, '#3f7a3a');
  c.fillStyle = g;
  c.fillRect(x, y, size, size);
  c.fillStyle = '#f2c14e';
  c.beginPath();
  c.arc(x + size * 0.72, y + size * 0.25, size * 0.1, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#2f5d2c';
  c.beginPath();
  c.moveTo(x, y + size * 0.75);
  c.quadraticCurveTo(x + size * 0.35, y + size * 0.45, x + size * 0.7, y + size * 0.72);
  c.lineTo(x + size, y + size * 0.68);
  c.lineTo(x + size, y + size);
  c.lineTo(x, y + size);
  c.fill();
  s.rrect(x, y, size, size, 0.4, { stroke: s.c('--rule'), lw: 0.3 });
}

function sheets(s: Scene, x: number, y: number, size: number, k: K, n = 4): void {
  const off = size * 0.07;
  for (let i = n - 1; i >= 0; i--) s.rrect(x + i * off, y - i * off, size, size, 0.6, { fill: s.tint(k, 0.14 + 0.06 * (n - i)), stroke: s.tint(k, 0.7), lw: 0.3 });
}

const latent: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const [ax, ay, aw, ah] = area(s, 0.14);
    const small = (text: string, x: number, y: number, k: K = '--ink-3', maxW = aw * 0.3) => fit(s, text, x, y, maxW, { size: 3.3, font: 'ui', color: s.c(k) });
    s.alpha(s.win('cost', 'ae'), () => {
      const sz = Math.min(aw, ah) * 0.42;
      picture(s, w / 2 - sz / 2, ay + ah * 0.06, sz);
      s.text('512 × 512 × 3', w / 2, ay + ah * 0.06 + sz + u * 5, { size: 4, font: 'mono', weight: 600 });
      fit(s, '= 786,432 numbers, at every step', w / 2, ay + ah * 0.06 + sz + u * 10, aw, { size: 3.6, font: 'ui', color: s.c('--ink-2') });
      s.alpha(s.ease('ldm', 0.6), () => pill(s, 'Rombach et al. (2021), released as Stable Diffusion', w / 2, ay + ah - u * 3, 'green', 3.4, 0.14));
    });
    const pipeA = s.ease('ae', 0.6) * (1 - s.ease('dit', 0.6));
    if (pipeA > 0) {
      const box = Math.min(aw * 0.2, ah * 0.3);
      const gap = (aw - 3 * box) / 2;
      const X = [ax, ax + box + gap, ax + 2 * (box + gap)];
      const row1 = ay + ah * 0.08;
      const row2 = ay + ah * 0.58;
      s.alpha(pipeA, () => {
        picture(s, X[0]!, row1, box);
        small('image', X[0]! + box / 2, row1 + box + u * 4, '--ink-2');
        s.arrow(X[0]! + box + u * 2, row1 + box / 2, X[1]! - u * 2, row1 + box / 2, s.c('--ink-3'), 0.5, 2.4);
        small('encoder', (X[0]! + box + X[1]!) / 2, row1 + box / 2 - u * 3, '--ink-3', gap - u * 2);
        sheets(s, X[1]!, row1, box, 'purple');
        s.text('64 × 64 × 4', X[1]! + box / 2, row1 + box + u * 4, { size: 3.4, font: 'mono', color: s.c('purple') });
        s.alpha(s.ease('fewer', 0.6), () => small('48× fewer numbers', X[1]! + box / 2, row1 + box + u * 8.5, '--ink', box + gap));
        s.alpha(s.ease('same', 0.6), () => {
          const dx = X[1]!, dy = row2;
          s.arrow(X[1]! + box / 2, row1 + box + u * 11, dx + box / 2, dy - u * 2, s.c('--ink-3'), 0.5, 2.4);
          const unet = s.ease('unet', 0.6);
          s.rrect(dx, dy, box, box * 0.9, 2, { fill: s.tint('blue', 0.1), stroke: s.c('blue'), lw: 0.45 });
          fit(s, unet > 0.5 ? 'U-Net' : 'denoiser', dx + box / 2, dy + box * 0.22, box - u * 2, { size: 3.6, font: 'ui', weight: 650, color: s.c('blue') });
          s.alpha(unet, () => {
            const c = s.ctx;
            const bx = dx + box * 0.12, bw = box * 0.76, top = dy + box * 0.4, bot = dy + box * 0.78;
            c.beginPath();
            c.moveTo(bx, top);
            c.lineTo(bx + bw * 0.35, bot);
            c.lineTo(bx + bw * 0.65, bot);
            c.lineTo(bx + bw, top);
            c.strokeStyle = s.c('blue');
            c.lineWidth = 0.5 * u;
            c.stroke();
            s.line(bx + bw * 0.12, top + (bot - top) * 0.35, bx + bw * 0.88, top + (bot - top) * 0.35, s.tint('blue', 0.6), 0.3, [0.8, 0.8]);
          });
          small('× 50 steps', dx + box / 2, dy + box * 0.9 + u * 4, '--ink-3', box + gap);
          s.arrow(dx + box + u * 2, dy + box * 0.45, X[2]! - u * 2, dy + box * 0.45, s.c('--ink-3'), 0.5, 2.4);
          small('decoder', (dx + box + X[2]!) / 2, dy + box * 0.45 - u * 3, '--ink-3', gap - u * 2);
          picture(s, X[2]!, dy, box * 0.9);
          small('new image', X[2]! + box * 0.45, dy + box * 0.9 + u * 4, '--ink-2');
          s.alpha(s.ease('text', 0.6), () => {
            const ty = dy + box * 0.45;
            s.arrow(X[0]! + box * 0.9, ty, dx - u * 2, ty, s.c('gold'), 0.5, 2.4);
            fit(s, '"a red bicycle"', X[0]! + box * 0.45, ty - u * 3.5, box + gap * 0.6, { size: 3.4, font: 'ui', weight: 600, color: s.c('gold') });
            small('text encoder', X[0]! + box * 0.45, ty + u * 4, 'gold', box + gap * 0.6);
          });
        });
      });
    }
    const ditA = s.ease('dit', 0.6);
    if (ditA > 0) {
      s.alpha(ditA, () => {
        const lb = Math.min(aw * 0.3, ah * 0.4);
        const lx = ax, ly = ay + ah * 0.06;
        const n = 6, cell = lb / n;
        for (let i = 0; i < n; i++)
          for (let j = 0; j < n; j++) s.rrect(lx + j * cell + 1, ly + i * cell + 1, cell - 2, cell - 2, 0.4, { fill: s.tint('purple', 0.15 + 0.1 * ((i + j) % 3)), stroke: s.tint('purple', 0.5), lw: 0.2 });
        small('noisy latent, 2 × 2 patches', lx + lb / 2, ly + lb + u * 4, '--ink-2', lb);
        const tx0 = lx + lb + aw * 0.08, tw = ax + aw - tx0;
        const nt = 9, tcw = tw / nt;
        const th = Math.min(tcw * 1.5, lb * 0.4);
        const ty = ly + lb * 0.3;
        const flowP = smooth(s.prog('dit') * 1.6);
        for (let i = 0; i < nt; i++) s.alpha(clamp01(flowP * nt - i), () => s.rrect(tx0 + i * tcw + 1, ty, tcw - 2, th, 0.6, { fill: s.tint('purple', 0.35), stroke: s.c('purple'), lw: 0.25 }));
        small('one token per patch', tx0 + tw / 2, ty + th + u * 4, '--ink-2', tw);
        s.arrow(lx + lb + u * 1.5, ty + th / 2, tx0 - u * 1.5, ty + th / 2, s.c('--ink-3'), 0.5, 2.2);
        const bx = tx0, bw = tw, by = ay + ah * 0.56, bh = ah * 0.26;
        s.arrow(tx0 + tw / 2, ty + th + u * 6.5, tx0 + tw / 2, by - u * 1.5, s.c('--ink-3'), 0.5, 2.2);
        s.rrect(bx, by, bw, bh, 2, { fill: s.tint('blue', 0.08), stroke: s.c('blue'), lw: 0.45 });
        for (let i = 0; i < 3; i++) s.rrect(bx + bw * 0.08, by + bh * (0.1 + 0.28 * i), bw * 0.84, bh * 0.22, 1, { fill: s.tint('blue', 0.2), stroke: s.tint('blue', 0.6), lw: 0.25 });
        small('transformer blocks, then back to patches of noise', bx + bw / 2, by + bh + u * 4, 'blue', bw);
        s.alpha(s.ease('adaln', 0.6), () => {
          for (let i = 0; i < 3; i++) fit(s, 'adaptive layer norm', bx + bw / 2, by + bh * (0.21 + 0.28 * i), bw * 0.8, { size: 3, font: 'mono', color: s.c('blue') });
          const lw = bx - lx - u * 3;
          fit(s, 'the step t and label c', lx + lw / 2, by + bh * 0.38, lw, { size: 3.4, font: 'ui', weight: 650, color: s.c('gold') });
          fit(s, 'set each scale and shift', lx + lw / 2, by + bh * 0.62, lw, { size: 3.4, font: 'ui', weight: 650, color: s.c('gold') });
          s.arrow(lx + lw + u * 0.5, by + bh * 0.5, bx - u * 1, by + bh * 0.5, s.c('gold'), 0.5, 2.2);
        });
        const pillY = ay + ah - u * 3;
        s.alpha(s.ease('dit', 0.6, 0.5) * (1 - s.ease('scale', 0.5)), () => pill(s, 'DiT: Peebles and Xie (2022)', w / 2, pillY, 'blue', 3.4, 0.14));
        s.alpha(s.ease('scale', 0.6), () => pill(s, 'quality grows with compute: Stable Diffusion 3, Sora', w / 2, pillY, 'purple', 3.4, 0.14));
      });
    }
  },
};

// ---------------------------------------------------------------- flow

const flowScene: SceneDef = {
  marks: {
    line: { tex: String.raw`\symxt = (1-t)\,\sym{x0}{x_0} + t\,\symeps`, x: 0.5, y: 0.8, size: 4.4 },
    vel: { tex: String.raw`\symvth(\symxt, t) \approx \symeps - \sym{x0}{x_0}`, x: 0.5, y: 0.9, size: 4.4 },
  },
  draw(s) {
    const { u } = s;
    if (s.since('euler') < 0) {
      const { main, side } = split(s, 0.62);
      const fr = new Frame(s, main, WIDE);
      fr.card();
      backdrop(fr, 0.22);
      const straight = s.ease('why', 1.4, 0.6);
      s.alpha((1 - 0.8 * s.ease('line', 0.6)) * (1 - s.ease('avg', 0.5)), () => {
        for (const { x0, e } of LINES.some.slice(0, 8)) {
          const xs: number[] = [], ys: number[] = [];
          for (let q = 0; q <= 40; q++) {
            const tt = Math.round((q / 40) * T);
            const a = lerp(sqrtAb(tt), 1 - q / 40, straight), b = lerp(sqrt1mAb(tt), q / 40, straight);
            xs.push(a * x0[0] + b * e[0]);
            ys.push(a * x0[1] + b * e[1]);
          }
          fr.path(xs, ys, s.tint('teal', 0.75), 0.5);
          fr.dot(x0[0], x0[1], 1, s.c('orange'));
          fr.dot(e[0], e[1], 1, s.c('teal'));
        }
      });
      heading(s, main, straight < 0.5 ? 'diffusion: curved paths from x₀ to ε' : 'flow matching: straight paths');
      const oneA = s.win('line', 'avg');
      if (oneA > 0) {
        const { x0, e } = LINES.some[3]!;
        const tt = 0.5 + 0.4 * Math.sin((s.t - s.at('line')) * 1.2);
        s.alpha(oneA, () => {
          fr.path([x0[0], e[0]], [x0[1], e[1]], s.c('teal'), 0.45);
          fr.dot(x0[0], x0[1], 1.5, s.c('orange'));
          fr.dot(e[0], e[1], 1.5, s.c('teal'));
          tag(s, 'x₀', fr.X(x0[0]) - u * 2.5, fr.Y(x0[1]), 'orange', 'right');
          tag(s, 'ε', fr.X(e[0]) + u * 2.5, fr.Y(e[1]), 'teal');
          const px = (1 - tt) * x0[0] + tt * e[0], py = (1 - tt) * x0[1] + tt * e[1];
          s.alpha(s.ease('vel', 0.6), () => fr.arrow(px, py, px + (e[0] - x0[0]) * 0.35, py + (e[1] - x0[1]) * 0.35, s.c('blue'), 0.6, 2.4));
          fr.dot(px, py, 1.6, s.c('purple'));
          tag(s, `t = ${tt.toFixed(2)}`, fr.X(px) - u * 2, fr.Y(py) + u * 4.5, 'purple', 'right', 3.3);
        });
      }
      const avgA = s.ease('avg', 0.6);
      if (avgA > 0) {
        s.alpha(avgA, () => {
          const [px, py] = LINES.probe;
          for (const { x0, e } of LINES.near.slice(0, 30)) fr.path([x0[0], e[0]], [x0[1], e[1]], s.tint('teal', 0.3), 0.25);
          for (const { x0, e } of LINES.near.slice(0, 30)) fr.arrow(px, py, px + (e[0] - x0[0]) * 0.22, py + (e[1] - x0[1]) * 0.22, s.tint('teal', 0.55), 0.25, 1.3);
          const [mx, my] = LINES.avg;
          const [nx, ny] = LINES.net;
          fr.arrow(px, py, px + mx * 0.5, py + my * 0.5, s.c('teal'), 0.8, 2.8);
          s.alpha(s.ease('avg', 0.6, 3), () => fr.arrow(px, py, px + nx * 0.5, py + ny * 0.5, s.c('blue'), 0.45, 2.2));
          fr.dot(px, py, 1.4, s.c('purple'));
        });
      }
      s.alpha(s.win('names', 'line'), () => {
        panelText(s, side, 'flow matching, rectified flow', 0.5, 0.32, { size: 4, weight: 650, color: s.c('teal') });
        panelText(s, side, 'Lipman et al.; Liu, Gong and Liu; Albergo and Vanden-Eijnden (2022)', 0.5, 0.62, { color: s.c('--ink-3') });
      });
      s.show('line', s.win('line', 'avg'), frac(s, side, 0.5, 0.25));
      s.show('vel', s.win('vel', 'avg'), frac(s, side, 0.5, 0.65));
      s.alpha(avgA, () => {
        panelText(s, side, 'at one point, many lines pass through:', 0.5, 0.2);
        panelText(s, side, 'their average direction', 0.5, 0.48, { size: 3.8, weight: 650, color: s.c('teal') });
        s.alpha(s.ease('avg', 0.6, 3), () => panelText(s, side, 'and the network\'s prediction there', 0.5, 0.74, { size: 3.8, weight: 650, color: s.c('blue') }));
      });
    } else {
      const [r1, r2] = pair(s);
      const runs: [Rect, typeof RUNS.flow4, string, number][] = [
        [r1, RUNS.flow4, 'flow matching: 4 Euler steps', smooth(s.prog('euler') * 1.3)],
        [r2, RUNS.ddim4, 'diffusion: 4 DDIM calls', s.since('four') >= 0 ? smooth(s.prog('four') * 1.6) : 0],
      ];
      for (const [r, run, label, q] of runs) {
        const fr = new Frame(s, r, WIDE);
        fr.card();
        backdrop(fr, 0.2);
        const head = Math.min(run.frames.length - 1, run.total * q);
        at(run.frames, head, buf300);
        tails(fr, run.frames, head, TRACK, (a) => s.tint('purple', 0.5 * (0.4 + 0.6 * a)), 4, 0.3);
        fr.dots(buf300, s.tint('purple', 0.85), 0.7);
        heading(s, r, label);
      }
      s.alpha(s.ease('sd3', 0.6), () => pill(s, 'Stable Diffusion 3 (2024): rectified flow with a transformer', s.w / 2, s.h - u * 6, 'teal', 3.3, 0.18));
    }
  },
};

// ---------------------------------------------------------------- outro

const TILES: [string, string, string, K][] = [
  ['fwd', 'forward', 'noise in small steps', 'slate'],
  ['train', 'train', 'predict the noise', 'red'],
  ['sample', 'sample', 'DDPM or DDIM', 'purple'],
  ['score', 'score', 'arrows to the data', 'blue'],
  ['cfg', 'guidance', 'push past the label', 'gold'],
  ['latent', 'latents', 'and transformers', 'green'],
  ['flow', 'flow matching', 'straight paths', 'teal'],
];

const outro: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const r = area(s, 0.13);
    const fr = new Frame(s, r, MOON);
    s.alpha(0.35 + 0.65 * s.ease('next', 0.8), () => {
      backdrop(fr, 0.2);
      fr.dots(RUNS.ddpm.last, s.tint('purple', 0.6), 0.75);
    });
    const tileA = 1 - s.ease('next', 0.6);
    if (tileA > 0) {
      const cols = s.w / s.h < 1.2 ? 2 : 4;
      const rows = Math.ceil(TILES.length / cols);
      const g = u * 2;
      const tw = Math.min((r[2] - g * (cols - 1)) / cols, u * 44);
      const th = Math.min((r[3] - g * (rows - 1)) / rows, u * 16);
      const ox = w / 2 - (cols * tw + (cols - 1) * g) / 2;
      const oy = r[1] + (r[3] - (rows * th + (rows - 1) * g)) / 2;
      TILES.forEach(([id, name, sub, k], i) => {
        const next = TILES[i + 1]?.[0] ?? 'next';
        const lit = s.since(id) >= 0 && s.since(next) < 0 ? 1 : 0;
        const appear = clamp01((s.t - s.at('recap')) / 0.4 - i * 0.25);
        s.alpha(appear * tileA, () => {
          const x = ox + (i % cols) * (tw + g);
          const y = oy + Math.floor(i / cols) * (th + g);
          s.rrect(x, y, tw, th, 2, { fill: s.c('--card') });
          s.rrect(x, y, tw, th, 2, { fill: s.tint(k, 0.08 + 0.2 * lit), stroke: s.tint(k, 0.4 + 0.6 * lit), lw: 0.3 + 0.3 * lit });
          fit(s, name, x + tw / 2, y + th * 0.38, tw - u * 2, { size: 4.4, font: 'display', weight: 600 });
          fit(s, sub, x + tw / 2, y + th * 0.7, tw - u * 2, { size: 3.4, font: 'ui', color: s.c(k) });
        });
      });
    }
    s.alpha(s.ease('next', 0.8, 0.4), () => {
      s.text('next: fine-tuning', w / 2, r[1] + u * 7, { size: 6, font: 'display', weight: 600, halo: true });
      fit(s, 'from a text predictor to an assistant', w / 2, r[1] + u * 14, r[2], { size: 3.8, font: 'ui', color: s.c('--ink-2'), halo: true });
    });
  },
};

export const scenes: Record<string, SceneDef> = {
  intro,
  forward,
  closed,
  loss,
  training,
  sampling,
  ddim,
  score,
  guidance,
  latent,
  flow: flowScene,
  outro,
};

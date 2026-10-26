import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { after } from '../../backprop/draw';
import { columns } from '../../draw';
import { ball } from '../../optimization/draw';
import { axes, clipped, curve, frame, type Frame, type Ink } from '../draw';

const Y = (s: Scene, v: number) => (v / 100) * s.h;
/** A number with at most two places and a typographic minus: `1.5`, `−0.8`, `0.85`. */
const nf = (v: number) => String(+v.toFixed(2)).replace('-', '−');
const clip = (r: number, e: number) => Math.min(1 + e, Math.max(1 - e, r));
/** One token's term in the clipped objective. */
const term = (r: number, a: number, e: number) => Math.min(r * a, clip(r, e) * a);

// ---- scene 1: the clip, one token at a time, with ε = 0.2

const EPS = 0.2;
const R0 = 0.4;
const R1 = 1.8;

interface Line {
  X: (r: number) => number;
  y: number;
}

/** The ratio on a number line from 0.4 to 1.8, with the clip range shaded at opacity `band`. */
function ratioLine(s: Scene, y: number, e: number, band: number, edge = 0): Line {
  const half = 36 * s.u;
  const X = (r: number) => s.w / 2 + ((r - (R0 + R1) / 2) / (R1 - R0)) * 2 * half;
  s.line(X(R0), y, X(R1), y, s.c('--axis'), 0.4);
  s.text('ρ', X(R1) + 2.4 * s.u, y, { size: 3.8, font: 'mono', weight: 650, align: 'left', color: s.c('purple') });
  s.line(X(1), y - 1.2 * s.u, X(1), y + 1.2 * s.u, s.c('--ink-3'), 0.3);
  // The band's edges are labeled once it shows; 1 between them would crowd them.
  s.alpha(1 - band, () => s.text('1', X(1), y + 3.6 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') }));
  s.alpha(band, () => {
    s.rrect(X(1 - e), y - 2.6 * s.u, X(1 + e) - X(1 - e), 5.2 * s.u, 0.6, { fill: s.tint('purple', 0.14), stroke: s.tint('purple', 0.45), lw: 0.25 });
    for (const v of [1 - e, 1 + e]) s.text(nf(v), X(v), y + 3.6 * s.u, { size: 2.8 + 0.4 * edge, font: 'mono', weight: 600 + 100 * edge, color: s.c('purple') });
  });
  return { X, y };
}

/** A token's ratio on the line; `clipA` shows the arrow to where clipping moves it. */
function marker(s: Scene, L: Line, r: number, e: number, a: number, clipA: number): void {
  s.alpha(a, () => {
    const c = clip(r, e);
    if (Math.abs(c - r) > 0.01) s.alpha(clipA, () => s.arrow(L.X(r), L.y, L.X(c), L.y, s.c('gold'), 0.8, 2.2));
    s.circle(L.X(r), L.y, 1.3 * s.u, { fill: s.c('purple'), stroke: s.c('--card'), lw: 0.4 });
    s.text(`ρ = ${nf(r)}`, L.X(r), L.y - 4.6 * s.u, { size: 3.2, font: 'mono', weight: 650, color: s.c('purple'), halo: true });
  });
}

const CASES = [
  { a: 1, r: 1.1 },
  { a: 1, r: 1.5 },
  { a: -1, r: 0.6 },
  { a: -1, r: 1.3 },
];
const HEAD: [string, Ink][] = [
  ['A', 'green'],
  ['ρ', 'purple'],
  ['ρA', '--ink-2'],
  ['clip(ρ)A', '--ink-2'],
  ['smaller', '--ink-2'],
];
/** The smaller term's color: plain inside the range, gold where it went flat, orange where it moved the wrong way. */
const SMALL: Ink[] = ['red', 'gold', 'gold', 'orange'];

/** When each cell of case i's row appears: A, ρ, ρA, the clipped term, the smaller. */
function reveal(s: Scene, i: number): number[] {
  if (i === 0) return [after(s, 'in', 0.08), after(s, 'in', 0.08), after(s, 'in', 0.42), after(s, 'in', 0.8), after(s, 'min', 0.05)];
  if (i === 1) return [s.ease('out', 0.5), s.ease('out', 0.5), after(s, 'out', 0.4), after(s, 'out', 0.75), after(s, 'min', 0.05)];
  if (i === 2) return [after(s, 'neg', 0.1), after(s, 'neg', 0.5), after(s, 'neg', 0.75), after(s, 'negmin', 0.08), after(s, 'negmin', 0.45)];
  return [s.ease('wrong', 0.5), after(s, 'wrong', 0.12), after(s, 'wrong', 0.38), after(s, 'wrong', 0.52), after(s, 'wrong', 0.7)];
}

/** How lit case i's row is while the voice is on it. */
function active(s: Scene, i: number): number {
  if (i === 0) return s.win('in', 'out') + s.win('min', 'neg') * 0.6;
  if (i === 1) return s.win('out', 'neg');
  if (i === 2) return s.win('neg', 'wrong');
  return s.ease('wrong', 0.6);
}

function ledger(s: Scene): void {
  const xs = columns(s, 5, 16);
  const y0 = Y(s, 38);
  const a = s.ease('in', 0.6);
  s.alpha(a, () => HEAD.forEach(([t, k], j) => s.text(t, xs[j]!, y0, { size: 3, font: 'mono', weight: 650, color: s.c(k) })));
  s.alpha(a, () => s.line(xs[0]! - 7 * s.u, y0 + 2.6 * s.u, xs[4]! + 7 * s.u, y0 + 2.6 * s.u, s.c('--axis'), 0.3));
  CASES.forEach(({ a: adv, r }, i) => {
    const y = y0 + (8 + 9 * i) * s.u;
    const t = reveal(s, i);
    const on = active(s, i);
    const raw = r * adv;
    const cl = clip(r, EPS) * adv;
    const small = Math.min(raw, cl);
    // The term the smaller one came from lights up with it.
    const src = (v: number) => (Math.abs(v - small) < 1e-9 ? t[4]! * on : 0);
    const vals: [string, Ink, number][] = [
      [adv > 0 ? '+1' : '−1', 'green', on * 0.4],
      [nf(r), 'purple', on * 0.4],
      [nf(raw), 'slate', on * 0.3 + src(raw)],
      [nf(cl), 'slate', on * 0.3 + src(cl)],
      [nf(small), SMALL[i]!, 0.3 + on * 0.7],
    ];
    vals.forEach(([lab, k, lit], j) => s.alpha(t[j]!, () => s.cell(xs[j]! - 6.5 * s.u, y - 3.5 * s.u, 13 * s.u, 7 * s.u, lab, k, { on: Math.min(1, lit), size: 3.3 })));
  });
}

const clipScene: SceneDef = {
  draw(s) {
    const y = Y(s, 19);
    const band = s.ease('clip', 0.6, 0.4);
    const edge = s.win('min', 'neg') + s.win('negmin', 'wrong') + after(s, 'wrong', 0.52);
    const L = ratioLine(s, y, EPS, band, Math.min(1, edge));
    // Far from 1 the samples say little.
    s.alpha(s.win('trust', 'clip'), () => {
      for (const v of [0.5, 1.7]) s.text('?', L.X(v), y - 5 * s.u, { size: 4.4, weight: 650, color: s.c('--ink-3') });
    });
    let r = 1;
    r = lerp(r, 1.1, s.ease('in', 0.8, 0.3));
    r = lerp(r, 1.5, s.ease('out', 0.8, 0.2));
    r = lerp(r, 1.7, after(s, 'min', 0.5, 0.8));
    r = lerp(r, 0.6, after(s, 'neg', 0.4, 0.8));
    r = lerp(r, 1.3, s.ease('wrong', 0.8, 0.2));
    const clipA = after(s, 'out', 0.7) * (1 - after(s, 'neg', 0.3, 0.3)) + after(s, 'negmin', 0.05) * (1 - s.ease('wrong', 0.3)) + after(s, 'wrong', 0.5);
    marker(s, L, r, EPS, s.ease('trust', 0.6), Math.min(1, clipA));
    ledger(s);
    const cap = (a: number, t: string, k: Ink) => s.alpha(a, () => s.text(t, s.w / 2, Y(s, 91), { size: 3.2, color: s.c(k) }));
    cap(s.win('trust', 'clip'), 'far from ρ = 1, the samples say little', '--ink-2');
    cap(s.win('clip', 'in'), 'within ε = 0.2 of 1: from 0.8 to 1.2', '--ink-2');
    cap(after(s, 'min', 0.45) * (1 - s.ease('neg', 0.5)), 'past 1.2, the term stays 1.2: no gain', 'gold');
    cap(after(s, 'negmin', 0.55) * (1 - s.ease('wrong', 0.5)), 'below 0.8, the term stays −0.8: flat', 'gold');
    cap(after(s, 'wrong', 0.75), 'moved the wrong way: still pushed down', 'orange');
  },
};

// ---- scene 2: the rule, and its shape

const objective = (a: number) => (r: number) => term(r, a, EPS);

/** One objective-versus-ratio panel; `hot` lights its flat part, `dots` the worked tokens. */
function panel(s: Scene, F: Frame, a: number, o: { show: number; line: number; hot: number; dots: [number, number][] }): void {
  s.alpha(o.show, () => {
    axes(s, F, 'ρ', '', { x: 'purple', y: 'green' });
    // Named in the corner its lines stay clear of.
    s.text(a > 0 ? 'A = +1' : 'A = −1', a > 0 ? F.l + 2 * s.u : F.r, F.t + 2 * s.u, { size: 3.4, font: 'mono', weight: 650, align: a > 0 ? 'left' : 'right', color: s.c('green') });
    s.rrect(F.X(1 - EPS), F.t, F.X(1 + EPS) - F.X(1 - EPS), F.b - F.t, 0, { fill: s.tint('purple', 0.1) });
    [1 - EPS, 1 + EPS].forEach((v) => s.text(v.toFixed(1), F.X(v), F.b + 3.2 * s.u, { size: 2.8, font: 'mono', color: s.c('purple') }));
    curve(s, F, (r) => r * a, R0, R1, '--ink-3', { dash: [1.2, 1], width: 0.4 });
  });
  if (o.line > 0) curve(s, F, objective(a), R0, R1, 'red', { width: 0.7, upto: o.line });
  // Where the minimum is flat: past 1 + ε for A > 0, below 1 - ε for A < 0.
  const [f0, f1] = a > 0 ? [1 + EPS, R1] : [R0, 1 - EPS];
  s.alpha(o.hot, () => clipped(s, F, () => s.line(F.X(f0), F.Y(objective(a)(f0)), F.X(f1), F.Y(objective(a)(f1)), s.c('gold'), 1.4)));
  for (const [r, al] of o.dots) {
    s.alpha(al, () => {
      const x = F.X(r);
      const y = F.Y(objective(a)(r));
      ball(s, x, y, 'purple', 1.5);
      s.text(nf(r), x, y + 4 * s.u, { size: 2.9, font: 'mono', weight: 650, color: s.c('purple'), halo: true });
    });
  }
}

const rule: SceneDef = {
  marks: {
    rule: {
      tex: String.raw`\min\big(\sym{rho}{\rho}\sym{A}{A},\ \operatorname{clip}(\sym{rho}{\rho},\, 1 - \sym{eps}{\epsilon},\, 1 + \sym{eps}{\epsilon})\,\sym{A}{A}\big)`,
      x: 0.5,
      y: 0.4,
      size: 4.6,
    },
    eps: { tex: String.raw`\sym{eps}{\epsilon} = 0.2\!:\ \ \operatorname{clip}(\sym{rho}{\rho},\, 0.8,\, 1.2)`, x: 0.5, y: 0.56, size: 4.4 },
  },
  draw(s) {
    const up = s.ease('plot', 0.8);
    s.show('rule', s.ease('rule', 0.6), { y: lerp(0.4, 0.07, up) });
    s.show('eps', after(s, 'rule', 0.55) * (1 - s.ease('plot', 0.4)));
    const l = s.w / 2 - 34 * s.u;
    const r = s.w / 2 + 34 * s.u;
    const top = frame(l, Y(s, 17), r, Y(s, 45), [R0, R1], [0.3, 1.9]);
    const bot = frame(l, Y(s, 56), r, Y(s, 84), [R0, R1], [-1.9, -0.3]);
    const show = s.ease('plot', 0.6, 0.4);
    panel(s, top, 1, { show, line: s.ease('plot', 1.4, 0.8), hot: after(s, 'plot', 0.3), dots: [[1.1, after(s, 'plot', 0.32)], [1.5, after(s, 'plot', 0.4)]] });
    panel(s, bot, -1, { show, line: after(s, 'plot', 0.5, 1.4), hot: after(s, 'plot', 0.74), dots: [[0.6, after(s, 'plot', 0.8)]] });
    const cap = (a: number, t: string, k: Ink) => s.alpha(a, () => s.text(t, s.w / 2, Y(s, 94), { size: 3.2, color: s.c(k) }));
    cap(after(s, 'plot', 0.3) * (1 - after(s, 'plot', 0.55)), 'A > 0: flat past 1.2, no push', 'gold');
    cap(after(s, 'plot', 0.74) * (1 - s.ease('why', 0.5)), 'A < 0: flat below 0.8, no push', 'gold');
    cap(s.ease('why', 0.6) * (1 - after(s, 'why', 0.62)), 'one batch, several updates, none far from π_old', '--ink-2');
    cap(after(s, 'why', 0.66), 'the KL penalty: the whole run near the reference', '--ink-2');
  },
};

// ---- scene 3: two worked problems, as the practice asks them

/** The objective for A = -2 with ε = 0.3, the second problem's token. */
const obj2 = (r: number) => term(r, -2, 0.3);
const OPTS = ['yes, up', 'yes, down', 'no: flat'];

const tryIt: SceneDef = {
  marks: {
    p1: { tex: String.raw`\sym{rho}{\rho} = 0.5,\quad \sym{A}{A} = -2,\quad \sym{eps}{\epsilon} = 0.2`, x: 0.5, y: 0.08, size: 4.8 },
    q1: { tex: String.raw`\text{its term in PPO's clipped objective?}`, x: 0.5, y: 0.17, size: 4.2 },
    s1: { tex: String.raw`\text{unclipped: } 0.5 \times (-2) = -1`, x: 0.5, y: 0.52, size: 4.6 },
    s2: { tex: String.raw`\text{clipped: } 0.8 \times (-2) = -1.6`, x: 0.5, y: 0.64, size: 4.6 },
    s3: { tex: String.raw`\min(-1,\ -1.6) = -1.6`, x: 0.5, y: 0.78, size: 5.2 },
    p2: { tex: String.raw`\sym{A}{A} = -2,\quad \sym{rho}{\rho} = 0.85,\quad \sym{eps}{\epsilon} = 0.3`, x: 0.5, y: 0.08, size: 4.8 },
    q2: { tex: String.raw`\text{still pushed? Which way?}`, x: 0.5, y: 0.17, size: 4.2 },
  },
  draw(s) {
    const one = s.ease('p1', 0.6) * (1 - s.ease('p2', 0.5));
    s.show('p1', one);
    s.show('q1', one * after(s, 'p1', 0.6));
    s.show('s1', one * after(s, 'a1', 0.05));
    s.show('s2', one * after(s, 'a1', 0.32));
    s.show('s3', one * after(s, 'a1', 0.78));
    s.alpha(one, () => {
      const L = ratioLine(s, Y(s, 33), EPS, after(s, 'p1', 0.6), after(s, 'a1', 0.32));
      marker(s, L, 0.5, EPS, after(s, 'p1', 0.2), after(s, 'a1', 0.32));
    });
    const two = s.ease('p2', 0.6, 0.3);
    s.show('p2', two);
    s.show('q2', two * after(s, 'p2', 0.75));
    s.alpha(two, () => {
      const F = frame(s.w / 2 - 30 * s.u, Y(s, 28), s.w / 2 + 30 * s.u, Y(s, 62), [R0, R1], [-3.8, -1]);
      axes(s, F, 'ρ', '', { x: 'purple', y: 'green' });
      s.text('A = −2', F.r, F.t + 2 * s.u, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('green') });
      const band = after(s, 'a2', 0.05);
      s.alpha(band, () => {
        s.rrect(F.X(0.7), F.t, F.X(1.3) - F.X(0.7), F.b - F.t, 0, { fill: s.tint('purple', 0.1) });
        [0.7, 1.3].forEach((v) => s.text(nf(v), F.X(v), F.b + 3.2 * s.u, { size: 2.8, font: 'mono', weight: 600, color: s.c('purple') }));
      });
      curve(s, F, obj2, R0, R1, 'red', { width: 0.7, upto: s.ease('p2', 1.2, 0.8) });
      s.alpha(after(s, 'a2', 0.3), () => clipped(s, F, () => s.line(F.X(R0), F.Y(obj2(R0)), F.X(0.7), F.Y(obj2(0.7)), s.c('gold'), 1.4)));
      // Uphill on the objective from 0.85, drawn just above the curve: toward a lower ratio, until 0.7.
      const x = F.X(0.85);
      const y = F.Y(obj2(0.85));
      const lift = 3.2 * s.u;
      s.alpha(after(s, 'a2', 0.6), () => s.arrow(F.X(1.08), F.Y(obj2(1.08)) - lift, F.X(0.72), F.Y(obj2(0.72)) - lift, s.c('orange'), 0.8, 2.4));
      s.alpha(after(s, 'p2', 0.4), () => {
        ball(s, x, y, 'purple', 1.5);
        s.text('0.85', x - 1.6 * s.u, y + 3.6 * s.u, { size: 2.9, font: 'mono', weight: 650, align: 'right', color: s.c('purple'), halo: true });
      });
      const xs = columns(s, 3, 22);
      const pick = after(s, 'a2', 0.82);
      s.alpha(after(s, 'p2', 0.75), () =>
        OPTS.forEach((t, i) => {
          const at: [number, number, number, number] = [xs[i]! - 10 * s.u, Y(s, 80) - 4 * s.u, 20 * s.u, 8 * s.u];
          s.cell(...at, t, '--ink-3', { size: 3.2 });
          if (i === 1) s.alpha(pick, () => s.cell(...at, t, 'green', { on: 1, size: 3.2 }));
        }),
      );
      s.alpha(pick, () => s.text('0.85 has not reached 0.7: still pushed down', s.w / 2, Y(s, 91), { size: 3.2, color: s.c('orange') }));
    });
  },
};

export const scenes: Record<string, SceneDef> = { clip: clipScene, rule, try: tryIt };

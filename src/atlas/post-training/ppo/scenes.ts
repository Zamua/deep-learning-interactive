import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { after } from '../../backprop/draw';
import { columns } from '../../draw';
import { ball } from '../../optimization/draw';
import { axes, clipped, curve, frame, rich, type Frame, type Ink } from '../draw';

const Y = (s: Scene, v: number) => (v / 100) * s.h;
/** A number with at most two places and a typographic minus: `1.5`, `−0.8`, `0.85`. */
const nf = (v: number) => String(+v.toFixed(2)).replace('-', '−');
const clip = (r: number, e: number) => Math.min(1 + e, Math.max(1 - e, r));
/** One token's term in the clipped objective. */
const term = (r: number, a: number, e: number) => Math.min(r * a, clip(r, e) * a);

/** Who introduced an idea, and when: small, at the top right of the stage, one line per entry. */
function cite(s: Scene, lines: string[], a: number) {
  s.alpha(a, () => lines.forEach((t, i) => s.text(t, s.w - 5 * s.u, (5 + 4.2 * i) * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true })));
}

function caption(s: Scene, text: string, a: number, k: Ink = '--ink-2', y = 95.5) {
  s.alpha(a, () => s.text(text, s.w / 2, Y(s, y), { size: 3.2, color: s.c(k), halo: true }));
}

/** Tick labels under a frame's floor. */
function ticks(s: Scene, F: Frame, vs: number[], k: Ink = '--ink-3') {
  for (const v of vs) s.text(nf(v), F.X(v), F.b + 3.2 * s.u, { size: 2.8, font: 'mono', weight: 600, color: s.c(k) });
}

// ---- scene 1: with nothing to stop it, a good token's ratio runs away from the batch

const farScene: SceneDef = {
  marks: {
    obj: { tex: String.raw`\text{objective} = \operatorname{mean}(\sym{rho}{\rho}\,\sym{A}{A})`, x: 0.5, y: 0.07, size: 4.4 },
  },
  draw(s) {
    s.show('obj', s.win('reuse', 'run'));
    const F = frame(s.w / 2 - 38 * s.u, Y(s, 16), s.w / 2 + 40 * s.u, Y(s, 80), [0, 3.4], [0, 3.4]);
    const ax = s.ease('reuse', 0.6, 0.4);
    s.alpha(ax, () => {
      axes(s, F, 'ρ', 'ρA', { x: 'purple', y: 'green' });
      ticks(s, F, [1, 2, 3]);
    });
    // Near ρ = 1 the batch describes the model; far from it, it says little.
    const near = s.ease('trust', 0.6, 0.3);
    s.alpha(near, () => {
      s.rrect(F.X(0.75), F.t, F.X(1.25) - F.X(0.75), F.b - F.t, 0, { fill: s.tint('teal', 0.12 + 0.08 * s.win('trpo', 'kl')) });
      s.alpha(after(s, 'trust', 0.3), () => {
        for (const [x, y] of [[2.2, 1.1], [2.8, 0.6], [2.5, 2.0], [1.9, 2.8]] as [number, number][]) s.text('?', F.X(x), F.Y(y), { size: 4.4, weight: 650, color: s.c('--ink-3') });
      });
    });
    s.alpha(s.ease('trpo', 0.6, 0.6), () => {
      s.text('trust region', F.X(1), F.t - 2.5 * s.u, { size: 3, font: 'mono', weight: 650, color: s.c('teal'), halo: true });
    });
    // The term for A = +1 is ρ itself: a straight line, rising for ever.
    curve(s, F, (r) => r, 0, 3.4, '--ink-2', { width: 0.6, upto: s.ease('line', 1.4, 0.6) });
    s.alpha(s.ease('line', 0.6), () => s.text('A = +1', F.r, F.b - 3 * s.u, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('green') }));
    // The token's ratio: 1, then pushed along the line, then held near 1 by TRPO.
    let r = 1;
    r = lerp(r, 1.5, after(s, 'run', 0.25, 0.8));
    r = lerp(r, 2, after(s, 'run', 0.45, 0.8));
    r = lerp(r, 3, after(s, 'run', 0.62, 0.8));
    r = lerp(r, 1.2, after(s, 'trpo', 0.35, 1.2));
    s.alpha(s.ease('line', 0.6, 1.5), () => {
      const x = F.X(r);
      const y = F.Y(r);
      ball(s, x, y, 'purple', 1.6);
      s.text(`ρ = ${r.toFixed(1)}`, x - 2.5 * s.u, y - 3.6 * s.u, { size: 3.1, font: 'mono', weight: 650, align: 'right', color: s.c('purple'), halo: true });
    });
    caption(s, 'the higher the ratio, the more the term pays', s.win('line', 'trust'));
    caption(s, 'far from ρ = 1: the batch says little', s.win('trust', 'trpo'));
    caption(s, 'TRPO: keep the KL divergence from π_old small', s.win('trpo', 'hard'), 'teal');
    caption(s, 'a hard limit, complicated to enforce', s.ease('hard', 0.6), '--ink-2');
    cite(s, ['TRPO · Schulman, Levine, Moritz,', 'Jordan & Abbeel, 2015'], s.win('trpo', 'kl'));
    cite(s, ['KL · Kullback & Leibler, 1951'], s.win('kl', 'hard'));
  },
};

// ---- scene 2: PPO clips the ratio and keeps the smaller term

const EPS = 0.2;
const R0 = 0.2;
const R1 = 2;
const PPO_CITE = ['Schulman, Wolski, Dhariwal,', 'Radford & Klimov, 2017'];

/** One panel of the term against ρ for advantage `a`: the unclipped line dashed, the clip band shaded. */
function panel(s: Scene, F: Frame, a: number, show: number, band: number) {
  s.alpha(show, () => {
    axes(s, F, 'ρ', '', { x: 'purple', y: 'green' });
    // Named in the corner its lines stay clear of.
    s.text(a > 0 ? 'A = +1' : 'A = −1', a > 0 ? F.l + 2 * s.u : F.r, F.t + 2 * s.u, { size: 3.4, font: 'mono', weight: 650, align: a > 0 ? 'left' : 'right', color: s.c('green') });
    curve(s, F, (r) => r * a, R0, R1, '--ink-3', { dash: [1.2, 1], width: 0.4 });
    s.alpha(band, () => {
      s.rrect(F.X(1 - EPS), F.t, F.X(1 + EPS) - F.X(1 - EPS), F.b - F.t, 0, { fill: s.tint('purple', 0.1) });
      ticks(s, F, [1 - EPS, 1 + EPS], 'purple');
    });
    s.alpha(1 - band, () => ticks(s, F, [1]));
  });
}

/** The min curve for advantage `a`, drawn in to `line`, its flat stretch lit gold at `hot`. */
function minCurve(s: Scene, F: Frame, a: number, line: number, hot: number) {
  if (line > 0) curve(s, F, (r) => term(r, a, EPS), R0, R1, 'red', { width: 0.7, upto: line });
  const [f0, f1] = a > 0 ? [1 + EPS, R1] : [R0, 1 - EPS];
  s.alpha(hot, () => clipped(s, F, () => s.line(F.X(f0), F.Y(term(f0, a, EPS)), F.X(f1), F.Y(term(f1, a, EPS)), s.c('gold'), 1.4)));
}

/** A token at ratio `r`: the kept term as a ball on the min curve, the other one hollow, and the pair read out. */
function token(s: Scene, F: Frame, r: number, a: number, al: number, read: number, corner: 'left' | 'right') {
  s.alpha(al, () => {
    const raw = r * a;
    const cl = clip(r, EPS) * a;
    const kept = Math.min(raw, cl);
    const other = kept === raw ? cl : raw;
    if (Math.abs(raw - cl) > 0.01) s.circle(F.X(r), F.Y(other), 1.2 * s.u, { fill: s.c('--card'), stroke: s.c('--ink-3'), lw: 0.35 });
    ball(s, F.X(r), F.Y(kept), 'purple', 1.5);
    s.alpha(read, () => {
      const x = corner === 'right' ? F.r - 1 * s.u : F.l + 2 * s.u;
      const y = F.b - 4 * s.u;
      const same = Math.abs(raw - cl) < 0.01;
      const runs: [string, Ink][] = same
        ? [[`ρ ${nf(r)}: both `, '--ink-2'], [nf(kept), 'red']]
        : [[`ρ ${nf(r)}: ${nf(raw)} or ${nf(cl)} → `, '--ink-2'], [nf(kept), 'red']];
      rich(s, runs, x, y, { size: 3, weight: 600, align: corner });
    });
  });
}

const clipScene: SceneDef = {
  draw(s) {
    // The name first, letter by letter: proximal, policy, optimization.
    const nameA = s.win('ppo', 'clip');
    s.alpha(nameA, () => {
      const cw = s.measure('M', { size: 9, font: 'mono', weight: 700 });
      'PPO'.split('').forEach((c, i) => s.text(c, s.w / 2 + (i - 1) * cw, Y(s, 30), { size: 9, font: 'mono', weight: 700, color: s.c('purple') }));
      s.alpha(s.ease('ppo', 0.6, 2.2), () =>
        rich(s, [['P', 'purple'], ['roximal ', '--ink-2'], ['P', 'purple'], ['olicy ', '--ink-2'], ['O', 'purple'], ['ptimization', '--ink-2']], s.w / 2, Y(s, 46), { size: 4.4, font: 'serif', weight: 550 }),
      );
      s.alpha(after(s, 'ppo', 0.55), () => s.text('proximal: near', s.w / 2, Y(s, 60), { size: 3.8, font: 'serif', italic: true, color: s.c('purple') }));
      s.alpha(after(s, 'ppo', 0.75), () => s.text('stay near π_old, the model that drew the batch', s.w / 2, Y(s, 70), { size: 3.2, color: s.c('--ink-2') }));
    });
    cite(s, PPO_CITE, s.win('ppo', 'clip'));
    const l = s.w / 2 - 36 * s.u;
    const r = s.w / 2 + 36 * s.u;
    // The A = +1 panel fills the stage until the A = −1 panel needs the lower half.
    const k = s.ease('neg', 0.8);
    const top = frame(l, Y(s, lerp(16, 9, k)), r, Y(s, lerp(80, 42, k)), [R0, R1], [0, 2.1]);
    const bot = frame(l, Y(s, 53), r, Y(s, 86), [R0, R1], [-2.1, 0]);
    const show1 = s.ease('clip', 0.6, 0.3);
    const band = s.ease('clip', 0.6, 2);
    panel(s, top, 1, show1, band);
    minCurve(s, top, 1, s.ease('flat', 1.2, 0.2), after(s, 'flat', 0.5) * (1 - s.ease('neg', 0.5)) + s.ease('pess', 0.6));
    // A = +1: the ratio slides from 1 past the band, and the kept term stops at 1.2.
    const r1 = lerp(1, 1.5, after(s, 'min', 0.15, 1.2));
    token(s, top, r1, 1, after(s, 'flat', 0.6), after(s, 'min', 0.5), 'right');
    const show2 = s.ease('neg', 0.6);
    panel(s, bot, -1, show2, show2);
    minCurve(s, bot, -1, s.ease('neg', 1.4, 0.4), after(s, 'neg', 0.4) * (1 - s.ease('wrong', 0.5)) + s.ease('pess', 0.6));
    // A = −1: down to 0.6, where the term is flat at −0.8; then the wrong way, up at 1.3.
    let r2 = lerp(1, 0.6, after(s, 'neg', 0.35, 1.2));
    r2 = lerp(r2, 1.3, after(s, 'wrong', 0.1, 1.4));
    token(s, bot, r2, -1, after(s, 'neg', 0.3), after(s, 'neg', 0.6), 'left');
    s.alpha(after(s, 'wrong', 0.6) * (1 - s.ease('pess', 0.5)), () => {
      const x = bot.X(1.3) + 3 * s.u;
      s.arrow(x, bot.Y(-1.3) - 4 * s.u, x, bot.Y(-1.3) + 4 * s.u, s.c('orange'), 0.7, 2.2);
    });
    caption(s, 'past 1.2: flat, no push', after(s, 'flat', 0.5) * (1 - s.ease('min', 0.5)), 'gold');
    caption(s, 'keep the smaller: no gain past the band', after(s, 'min', 0.6) * (1 - s.ease('neg', 0.5)), 'gold');
    caption(s, 'below 0.8: flat at −0.8', after(s, 'neg', 0.6) * (1 - s.ease('wrong', 0.5)), 'gold');
    caption(s, 'the wrong way: still pushed down', after(s, 'wrong', 0.6) * (1 - s.ease('pess', 0.5)), 'orange');
    caption(s, 'the smaller term: a pessimistic bound', after(s, 'pess', 0.5), '--ink-2');
  },
};

// ---- scene 3: the rule, and what the clip limits next to the KL penalty

const HOPS = 4;

/** An arc from x0 to x1 on the line y, bulging up by `lift` px, drawn to fraction `t`. */
function arc(s: Scene, x0: number, x1: number, y: number, lift: number, k: string, t: number, dash?: number[]) {
  if (t <= 0) return;
  const c = s.ctx;
  c.beginPath();
  const n = 40;
  for (let i = 0; i <= n * t; i++) {
    const f = i / n;
    const x = x0 + (x1 - x0) * f;
    const yy = y - lift * 4 * f * (1 - f);
    if (i) c.lineTo(x, yy);
    else c.moveTo(x, yy);
  }
  c.strokeStyle = k;
  c.lineWidth = 0.45 * s.u;
  c.setLineDash(dash ? dash.map((d) => d * s.u) : []);
  c.stroke();
  c.setLineDash([]);
}

const rule: SceneDef = {
  marks: {
    rule: {
      tex: String.raw`\min\big(\sym{rho}{\rho}\sym{A}{A},\ \operatorname{clip}(\sym{rho}{\rho},\, 1 - \sym{eps}{\epsilon},\, 1 + \sym{eps}{\epsilon})\,\sym{A}{A}\big)`,
      x: 0.5,
      y: 0.12,
      size: 4.6,
    },
  },
  draw(s) {
    s.show('rule', s.ease('rule', 0.6), { y: lerp(0.42, 0.12, s.ease('batch', 0.8)) });
    const y = Y(s, 56);
    const x0 = s.w / 2 - 38 * s.u;
    const step = 19 * s.u;
    const xs = Array.from({ length: HOPS + 1 }, (_, i) => x0 + i * step);
    const show = s.ease('batch', 0.6);
    // Hop k is batch k's updates; each starts at its π_old and may not go far.
    const hop = (k: number) => after(s, 'batch', 0.08 + 0.2 * k, 1.4);
    s.alpha(show, () => {
      // Training runs left to right.
      s.arrow(x0, y, xs[HOPS]! + 6 * s.u, y, s.c('--axis'), 0.35, 2);
      s.rrect(x0 - 2 * s.u, y - 2 * s.u, 4 * s.u, 4 * s.u, 0.6, { fill: s.c('slate'), stroke: s.c('--card'), lw: 0.4 });
      s.text('π_ref', x0 - 3 * s.u, y, { size: 3, font: 'mono', weight: 650, align: 'right', color: s.c('slate') });
      for (let k = 0; k < HOPS; k++) {
        const t = hop(k);
        const live = t > 0 && hop(k + 1) <= 0;
        // The clip's reach around this batch's π_old.
        s.alpha(live ? 1 : 0.35 * Math.min(1, t * 3), () => s.rrect(xs[k]!, y - 9 * s.u, step, 6 * s.u, 1, { fill: s.tint('purple', 0.1), stroke: s.tint('purple', 0.4), lw: 0.25 }));
        arc(s, xs[k]!, xs[k + 1]!, y, 5 * s.u, s.c('purple'), t);
        if (t >= 1 && k < HOPS - 1) s.circle(xs[k + 1]!, y, 0.9 * s.u, { fill: s.c('--ink-3') });
      }
      // The model now, and the π_old it is held near.
      let cur = 0;
      for (let k = 0; k < HOPS; k++) cur = Math.max(cur, Math.min(1, hop(k)) + k);
      const kNow = Math.min(HOPS - 1, Math.floor(cur));
      ball(s, x0 + cur * step, y, 'purple', 1.5);
      s.text('π_old', xs[kNow]!, y - 11.5 * s.u, { size: 3, font: 'mono', weight: 650, align: 'left', color: s.c('purple'), halo: true });
    });
    // The KL penalty: one long leash from the model back to the frozen start.
    const kl = s.ease('kl', 0.6, 0.3);
    s.alpha(kl, () => {
      arc(s, xs[HOPS]!, x0, y, -22 * s.u, s.c('slate'), s.ease('kl', 1.4, 0.3), [1.2, 1]);
      s.text('KL penalty: the whole run, near π_ref', s.w / 2, y + 27 * s.u, { size: 3.1, font: 'mono', weight: 600, color: s.c('slate'), halo: true });
    });
    s.alpha(after(s, 'batch', 0.3), () => s.text('clip: each batch, near its π_old', s.w / 2, Y(s, 34), { size: 3.1, font: 'mono', weight: 600, color: s.c('purple') }));
    caption(s, 'a KL penalty against π_old instead: did worse in their tests', s.ease('tried', 0.6, 0.5), '--ink-2', 94);
  },
};

// ---- scene 4: two worked problems, as the practice asks them

/** The ratio on a number line from 0.4 to 1.8, with the clip range shaded at opacity `band`. */
function ratioLine(s: Scene, y: number, e: number, band: number, edge = 0): { X: (r: number) => number; y: number } {
  const half = 36 * s.u;
  const X = (r: number) => s.w / 2 + ((r - 1.1) / 1.4) * 2 * half;
  s.line(X(0.4), y, X(1.8), y, s.c('--axis'), 0.4);
  s.text('ρ', X(1.8) + 2.4 * s.u, y, { size: 3.8, font: 'mono', weight: 650, align: 'left', color: s.c('purple') });
  s.line(X(1), y - 1.2 * s.u, X(1), y + 1.2 * s.u, s.c('--ink-3'), 0.3);
  s.alpha(1 - band, () => s.text('1', X(1), y + 3.6 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') }));
  s.alpha(band, () => {
    s.rrect(X(1 - e), y - 2.6 * s.u, X(1 + e) - X(1 - e), 5.2 * s.u, 0.6, { fill: s.tint('purple', 0.14), stroke: s.tint('purple', 0.45), lw: 0.25 });
    for (const v of [1 - e, 1 + e]) s.text(nf(v), X(v), y + 3.6 * s.u, { size: 2.8 + 0.4 * edge, font: 'mono', weight: 600 + 100 * edge, color: s.c('purple') });
  });
  return { X, y };
}

/** A token's ratio on the line; `clipA` shows the arrow to where clipping moves it. */
function marker(s: Scene, L: { X: (r: number) => number; y: number }, r: number, e: number, a: number, clipA: number): void {
  s.alpha(a, () => {
    const c = clip(r, e);
    if (Math.abs(c - r) > 0.01) s.alpha(clipA, () => s.arrow(L.X(r), L.y, L.X(c), L.y, s.c('gold'), 0.8, 2.2));
    s.circle(L.X(r), L.y, 1.3 * s.u, { fill: s.c('purple'), stroke: s.c('--card'), lw: 0.4 });
    s.text(`ρ = ${nf(r)}`, L.X(r), L.y - 4.6 * s.u, { size: 3.2, font: 'mono', weight: 650, color: s.c('purple'), halo: true });
  });
}

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
      const F = frame(s.w / 2 - 30 * s.u, Y(s, 28), s.w / 2 + 30 * s.u, Y(s, 62), [0.4, 1.8], [-3.8, -1]);
      axes(s, F, 'ρ', '', { x: 'purple', y: 'green' });
      s.text('A = −2', F.r, F.t + 2 * s.u, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('green') });
      const band = after(s, 'a2', 0.05);
      s.alpha(band, () => {
        s.rrect(F.X(0.7), F.t, F.X(1.3) - F.X(0.7), F.b - F.t, 0, { fill: s.tint('purple', 0.1) });
        ticks(s, F, [0.7, 1.3], 'purple');
      });
      curve(s, F, obj2, 0.4, 1.8, 'red', { width: 0.7, upto: s.ease('p2', 1.2, 0.8) });
      s.alpha(after(s, 'a2', 0.3), () => clipped(s, F, () => s.line(F.X(0.4), F.Y(obj2(0.4)), F.X(0.7), F.Y(obj2(0.7)), s.c('gold'), 1.4)));
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

export const scenes: Record<string, SceneDef> = { far: farScene, clip: clipScene, rule, try: tryIt };

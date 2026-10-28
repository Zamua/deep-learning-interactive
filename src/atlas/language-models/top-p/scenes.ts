import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { bars } from '../../draw';
import { after, caption } from '../../networks/draw';
import { chip, ghost, note, rich, spread, type Ink } from '../draw';

const TOK = ['cat', 'dog', 'fish', 'sofa', 'ran', 'blue'];
const P = [0.4, 0.25, 0.15, 0.1, 0.06, 0.04];
/** The top three, renormalized: each divided by the 0.80 they hold. */
const Q = P.slice(0, 3).map((p) => p / 0.8);
const MAIN: [string, number][] = TOK.map((t, i) => [t, P[i]!]);
const SURE: [string, number][] = [['time', 0.85], ['the', 0.05], ['ran', 0.04], ['blue', 0.03], ['sofa', 0.02], ['dog', 0.01]];
const FLAT: [string, number][] = [['red', 0.24], ['blue', 0.2], ['green', 0.16], ['gold', 0.12], ['gray', 0.1], ['pink', 0.08], ['tan', 0.06], ['jade', 0.04]];
const f2 = (v: number) => v.toFixed(2);

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** How many of the most likely it takes for the running total to reach `p`. */
function nucleus(items: [string, number][], p: number): number {
  let run = 0;
  for (let i = 0; i < items.length; i++) {
    run += items[i]![1];
    if (run >= p - 1e-9) return i + 1;
  }
  return items.length;
}

// ---- tail: the bars, the tail they trail off into, and a dart that lands there

/** The text so far as chips, with more slots after it. */
function textRow(s: Scene, y: number, words: string[], extra: { label: string; k: Ink; a: number; shown?: number }[]): void {
  const xs = spread(s, words.length + extra.length, 12.5);
  words.forEach((w, i) => chip(s, xs[i]!, y, w, 'orange', { w: 11, h: 7, size: 3.2 }));
  extra.forEach((e, j) => {
    const x = xs[words.length + j]!;
    s.alpha(e.shown ?? 1, () => {
      if (e.a < 1) s.alpha(1 - e.a, () => ghost(s, x, y, '', '--ink-3', 11, 7));
      s.alpha(e.a, () => chip(s, x, y, e.label, e.k, { w: 11, h: 7, size: 3.2, on: 1 }));
    });
  });
}

/** The six bars, the tail's three crossfading to red by `red`. */
function tokenBars(s: Scene, base: number, o: { grow?: number; red?: number; veil?: number; vals?: number[]; top?: Ink } = {}): number[] {
  const xs = spread(s, 6, s.tall ? 15 : 16);
  const vals = o.vals ?? P;
  const opt = { max: 0.5, height: 26, w: 10, grow: o.grow ?? 1, fmt: f2 };
  bars(s, xs.slice(0, 3), base, vals.slice(0, 3), o.top ?? 'teal', opt);
  const red = o.red ?? 0;
  s.alpha(1 - red, () => bars(s, xs.slice(3), base, vals.slice(3), 'teal', opt));
  s.alpha(red, () => bars(s, xs.slice(3), base, vals.slice(3), 'red', opt));
  const veil = o.veil ?? 0;
  if (veil > 0) {
    const x0 = xs[3]! - 6 * s.u;
    s.alpha(veil, () => s.rrect(x0, base - 14 * s.u, xs[5]! + 6 * s.u - x0, 14.4 * s.u, 1, { fill: s.tint('--card', 0.78) }));
  }
  TOK.forEach((t, i) => s.text(t, xs[i]!, base + 3.8 * s.u, { size: 3.2, font: 'mono', weight: 600, color: s.c(i >= 3 && veil > 0.5 ? '--ink-3' : '--ink-2') }));
  return xs;
}

/** Where the darts land on the bars laid end to end: the last one in sofa's stretch. */
const DARTS = [0.22, 0.55, 0.71, 0.12, 0.84];

const tail: SceneDef = {
  draw(s) {
    const u = s.u;
    const land = after(s, 'dart', 0.82, 0.4);
    textRow(s, 14 * u, ['I', 'fed', 'my'], [
      { label: 'sofa', k: 'red', a: land },
      { label: '…', k: 'red', a: s.ease('stuck', 0.6, 1.2), shown: s.ease('stuck', 0.5) },
    ]);
    const base = s.h * 0.55;
    const red = s.ease('tail', 0.8, 1);
    const xs = tokenBars(s, base, { grow: s.ease('dist', 0.9, 0.6), red });
    s.alpha(s.ease('tail', 0.6, 1) * (1 - s.ease('dart', 0.5)), () => {
      const x0 = xs[3]! - 6 * u;
      const x1 = xs[5]! + 6 * u;
      s.rrect(x0, base - 13 * u, x1 - x0, 20 * u, 1.6, { stroke: s.c('red'), lw: 0.4 });
      note(s, 'the tail: 0.20 in all', (x0 + x1) / 2, base - 16.5 * u, 'red', 3.1);
    });

    // The bars laid end to end, from 0 to 1, with darts falling on them.
    const L = s.w / 2 - (s.tall ? 40 : 44) * u;
    const R = s.w / 2 + (s.tall ? 40 : 44) * u;
    const ly = s.h * 0.74;
    s.alpha(s.ease('dart', 0.6), () => {
      let acc = 0;
      P.forEach((p, i) => {
        const x = L + acc * (R - L);
        const w = p * (R - L);
        const k: Ink = i < 3 ? 'teal' : 'red';
        s.rrect(x + 0.15 * u, ly - 3 * u, w - 0.3 * u, 6 * u, 0.6, { fill: s.tint(k, 0.22 + 0.1 * (i % 2)), stroke: s.tint(k, 0.7), lw: 0.25 });
        if (i < 3) s.text(TOK[i]!, x + w / 2, ly + 0.2 * u, { size: 2.8, font: 'mono', weight: 600, color: s.c('--ink'), halo: true });
        acc += p;
      });
      s.text('0', L - 2 * u, ly + 0.2 * u, { size: 2.6, font: 'mono', align: 'right', color: s.c('--ink-3') });
      s.text('1', R + 2 * u, ly + 0.2 * u, { size: 2.6, font: 'mono', align: 'left', color: s.c('--ink-3') });
      const t0 = L + 0.8 * (R - L);
      s.line(t0, ly + 4 * u, R, ly + 4 * u, s.c('red'), 0.3);
      note(s, 'tail', (t0 + R) / 2, ly + 6.6 * u, 'red', 2.8);
      DARTS.forEach((d, i) => {
        const a = after(s, 'dart', 0.15 + i * 0.14, 0.25);
        if (a <= 0) return;
        const dx = L + d * (R - L);
        const last = i === DARTS.length - 1;
        s.alpha(a * (last ? 1 : 1 - 0.6 * after(s, 'dart', 0.29 + i * 0.14, 0.25)), () => {
          s.arrow(dx, ly - 9 * u, dx, ly - 3.3 * u, s.c(last ? 'red' : 'purple'), 0.4, 1.4);
        });
      });
    });

    cite(s, 'Holtzman, Buys, Du, Forbes & Choi, 2019', s.ease('holtzman', 0.6));
    const cy = s.h * 0.89;
    s.alpha(s.win('dart', 'stuck') * after(s, 'dart', 0.3), () => caption(s, '1 throw in 5 lands in the tail', cy, 'red', 3.2));
    s.alpha(s.win('stuck', 'holtzman'), () => caption(s, 'every later word builds on “sofa”', cy, '--ink-2', 3.2));
    s.alpha(s.win('holtzman', 'blame'), () => caption(s, 'pure sampling: “incoherent gibberish”', cy, 'red', 3.2, { italic: true }));
    s.alpha(s.ease('blame', 0.6), () => caption(s, 'the unreliable tail: many tokens, each unlikely', cy, 'red', 3));
  },
};

// ---- topk: keep the k likeliest, then divide by what they hold

const topk: SceneDef = {
  draw(s) {
    const u = s.u;
    textRow(s, 14 * u, ['I', 'fed', 'my'], [{ label: '', k: 'teal', a: 0 }]);
    const base = s.h * 0.55;
    const rn = s.ease('renorm', 1.2, 1.2);
    const cut = s.ease('cut', 0.7, 1.2);
    const vals = P.map((p, i) => (i < 3 ? lerp(p, Q[i]!, rn) : p));
    const xs = tokenBars(s, base, { red: 1, veil: cut, vals, top: rn > 0.5 ? 'gold' : 'teal' });
    s.alpha(cut, () => {
      const x = (xs[2]! + xs[3]!) / 2;
      s.line(x, base - 30 * u, x, base + 6 * u, s.c('slate'), 0.45, [1.4, 1]);
      const k3 = s.ease('kept', 0.5);
      s.alpha(1 - k3, () => note(s, 'k', x + 2 * u, base - 30 * u, 'slate', 3.4, 'left'));
      s.alpha(k3, () => note(s, 'k = 3', x + 2 * u, base - 30 * u, 'slate', 3.2, 'left'));
    });
    cite(s, 'Fan, Lewis & Dauphin, 2018', s.win('fan', 'kept'));
    const y1 = s.h * 0.71;
    const y2 = s.h * 0.79;
    s.alpha(s.win('kept', 'name'), () => rich(s, [['kept: 0.40 + 0.25 + 0.15 = ', '--ink-3'], ['0.80', 'gold']], s.w / 2, y1, { size: 3.3, weight: 600 }));
    s.alpha(s.ease('name', 0.6), () => rich(s, [['now: 0.50 + 0.31 + 0.19 = ', '--ink-3'], ['1.00', 'gold']], s.w / 2, y1, { size: 3.3, weight: 600 }));
    s.alpha(s.ease('renorm', 0.6), () => note(s, 'divide each by 0.80: cat 0.40 → 0.50', s.w / 2, y2, '--ink-2', 3.1));
    const cy = s.h * 0.89;
    s.alpha(s.win('fan', 'kept'), () => caption(s, 'stories: each word from the top 10', cy, '--ink-2', 3.2));
    s.alpha(s.ease('name', 0.6, 2), () => caption(s, 'renormalized: sample from these 3', cy, 'gold', 3.2));
  },
};

// ---- nucleus: the bars end to end, cut where the running total reaches p

interface Strip {
  x0: number;
  W: number;
}

/** Probabilities as one strip from 0 to 1, a segment per token; the first `kept` light up by `on`. */
function strip(s: Scene, y: number, items: [string, number][], o: { a: number; label: string; kept?: number; on?: number; tag?: string }): Strip {
  const u = s.u;
  const x0 = s.w / 2 - (s.tall ? 44 : 50) * u;
  const W = (s.tall ? 88 : 100) * u;
  const h = 7.5 * u;
  const on = o.on ?? 0;
  const kept = o.kept ?? 0;
  s.alpha(o.a, () => {
    let acc = 0;
    items.forEach(([t, q], i) => {
      const x = x0 + acc * W;
      const k: Ink = i < kept && on > 0.5 ? 'gold' : 'teal';
      const lit = i < kept ? on : 0;
      s.alpha(1 - 0.45 * (i >= kept ? on : 0), () => {
        s.rrect(x + 0.2 * u, y - h / 2, q * W - 0.4 * u, h, 0.8, { fill: s.tint(k, 0.22 + 0.45 * lit), stroke: s.tint(k, 0.7) });
      });
      if (q * W > s.measure(t, { size: 2.8, font: 'mono' }) + 2.4 * u) s.text(t, x + (q * W) / 2, y + 0.2 * u, { size: 2.8, font: 'mono', weight: 600, color: s.c('--ink') });
      acc += q;
    });
    s.text(o.label, x0, y - h / 2 - 3.2 * u, { size: 3, align: 'left', color: s.c('--ink-2') });
    if (o.tag) s.alpha(on, () => s.text(o.tag!, x0 + W, y - h / 2 - 3.2 * u, { size: 3, font: 'mono', weight: 650, align: 'right', color: s.c('gold') }));
  });
  return { x0, W };
}

/** A cut across a strip at fraction `f` of the way, with a label under it. */
function mark(s: Scene, g: Strip, y: number, f: number, k: Ink, label: string, a: number, dash = false): void {
  s.alpha(a, () => {
    const x = g.x0 + f * g.W;
    s.line(x, y - 6 * s.u, x, y + 6 * s.u, s.c(k), 0.5, dash ? [1.2, 0.9] : undefined);
    if (label) s.text(label, x, y + 8.6 * s.u, { size: 2.8, font: 'mono', weight: 650, color: s.c(k), halo: true });
  });
}

const cum = (items: [string, number][], n: number) => items.slice(0, n).reduce((a, [, q]) => a + q, 0);

const nucleusScene: SceneDef = {
  draw(s) {
    const u = s.u;
    const yM = s.h * 0.17;
    const yA = s.h * 0.44;
    const yB = s.h * 0.71;
    const reach = s.ease('reach', 0.6);
    const adapt = s.ease('adapt', 0.6, 0.4);
    const glow = s.ease('nucleus', 0.8);
    const fixed = s.win('fixed', 'topp');

    const gM = strip(s, yM, MAIN, { a: 1, label: 'after “I fed my”', kept: 3, on: Math.max(reach, glow), tag: 'keeps 3' });
    const gA = strip(s, yA, SURE, { a: s.ease('context', 0.6, 1.5), label: 'after “Once upon a”', kept: nucleus(SURE, 0.8), on: Math.max(adapt, glow), tag: 'keeps 1' });
    const gB = strip(s, yB, FLAT, { a: s.ease('flat', 0.6, 0.4), label: 'after “My favorite color is”', kept: nucleus(FLAT, 0.8), on: s.ease('adapt', 0.6, 3), tag: 'keeps 5' });

    // A fixed k = 3 on both: junk kept after one, good colors cut after the other.
    mark(s, gA, yA, cum(SURE, 3), 'slate', '', fixed, true);
    mark(s, gB, yB, cum(FLAT, 3), 'slate', '', fixed, true);
    s.alpha(fixed * after(s, 'fixed', 0.3), () => {
      const x0 = gA.x0 + cum(SURE, 1) * gA.W;
      s.rrect(x0, yA - 5 * u, cum(SURE, 3) * gA.W - (x0 - gA.x0), 10 * u, 1, { stroke: s.c('red'), lw: 0.45 });
      note(s, 'k = 3 keeps “the” and “ran”', s.w / 2, yA + 9 * u, 'red', 3);
    });
    s.alpha(fixed * after(s, 'fixed', 0.65), () => {
      const x0 = gB.x0 + cum(FLAT, 3) * gB.W;
      s.rrect(x0, yB - 4 * u, gB.x0 + gB.W - x0, 8 * u, 0.8, { fill: s.tint('--card', 0.7) });
    });
    s.alpha(fixed * after(s, 'fixed', 0.65), () => note(s, 'k = 3 cuts gold, gray, pink …', s.w / 2, yB + 9 * u, 'red', 3));

    // Top-p on "I fed my": running totals from the top until one reaches p.
    [1, 2].forEach((n) => {
      s.alpha(after(s, 'add', n === 1 ? 0.35 : 0.75, 0.4) * (1 - glow), () => s.text(f2(cum(MAIN, n)), gM.x0 + cum(MAIN, n) * gM.W, yM + 8.6 * u, { size: 2.8, font: 'mono', weight: 650, color: s.c('gold'), halo: true }));
    });
    mark(s, gM, yM, 0.8, 'red', '0.80 = p', after(s, 'reach', 0.15));

    // The same p on the other two.
    mark(s, gA, yA, 0.8, 'red', 'p', adapt);
    mark(s, gB, yB, 0.8, 'red', 'p', s.ease('adapt', 0.6, 3));
    s.slot('na', s.since('adapt') > 1 ? 1 : '?');
    s.slot('nb', s.since('adapt') > 3.4 ? 5 : '?');

    const cy = s.h * 0.92;
    cite(s, 'Holtzman et al., 2019', s.win('topp', 'add'));
    s.alpha(s.win('context', 'flat'), () => caption(s, 'context: the text so far', cy, '--ink-2', 3.2));
    s.alpha(s.win('topp', 'adapt'), () => caption(s, 'keep the fewest that add up to at least p', cy, 'red', 3.2));
    s.alpha(s.win('adapt', 'nucleus'), () => caption(s, 'sure: few tokens · unsure: many', cy, '--ink-2', 3.2));
    s.alpha(glow, () => caption(s, 'the nucleus: a small core, most of the probability', cy, 'gold', 3));
  },
};

// ---- ends: both dials at their limits, and why neither ever flattens the bars

const ends: SceneDef = {
  draw(s) {
    const u = s.u;
    const y1 = s.h * 0.15;
    const y2 = s.h * 0.38;
    const ord = s.ease('order', 0.6);
    const one = s.ease('one', 0.6, 1.4);
    const all = s.ease('all', 0.6, 2.2);
    s.alpha(1 - 0.5 * ord, () => {
      strip(s, y1, MAIN, { a: 1, label: 'k = 1, or a tiny p', kept: 1, on: one, tag: 'keeps 1' });
      strip(s, y2, MAIN, { a: s.ease('all', 0.6), label: 'k = V, or p = 1', kept: 6, on: all, tag: 'keeps all' });
      s.alpha(after(s, 'one', 0.7), () => note(s, 'renormalized: cat gets 1.00 · greedy', s.w / 2, y1 + 8.6 * u, '--ink-2', 3));
      s.alpha(after(s, 'all', 0.75), () => note(s, 'nothing cut · plain sampling', s.w / 2, y2 + 8.6 * u, '--ink-2', 3));
    });

    // Renormalizing scales every kept bar by the same 1 / 0.80.
    s.alpha(ord, () => {
      const base = s.h * 0.88;
      const gap = s.tall ? 24 : 28;
      const left = spread(s, 3, 10, s.w / 2 - gap * u);
      const right = spread(s, 3, 10, s.w / 2 + gap * u);
      const opt = { max: 0.5, height: 18, w: 7, fmt: f2 };
      bars(s, left, base, P.slice(0, 3), 'teal', opt);
      bars(s, right, base, Q, 'gold', { ...opt, grow: s.ease('order', 0.9, 0.8) });
      [left, right].forEach((xs) => TOK.slice(0, 3).forEach((t, i) => s.text(t, xs[i]!, base + 3.4 * u, { size: 2.6, font: 'mono', color: s.c('--ink-3') })));
      note(s, 'kept', left[1]!, base - 27 * u, 'teal', 3);
      note(s, 'renormalized', right[1]!, base - 27 * u, 'gold', 3);
      s.arrow(s.w / 2 - 5 * u, base - 10 * u, s.w / 2 + 5 * u, base - 10 * u, s.c('--ink-3'), 0.35, 1.8);
      note(s, '× 1.25', s.w / 2, base - 14 * u, '--ink-2', 3);
      note(s, 'cut, never flatten: same order', s.w / 2, s.h * 0.52, '--ink-2', 3.1);
    });
  },
};

export const scenes: Record<string, SceneDef> = { tail, topk, nucleus: nucleusScene, ends };

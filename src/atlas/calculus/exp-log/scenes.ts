import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp, smooth } from '../../../lecture/scene';
import type { Color } from '../../../core/symbols';
import { caption } from '../../networks/draw';
import { after, cite } from '../../draw';
import { Frame, type Rect } from '../draw';

type View = [number, number, number, number];
const L2 = Math.log(2);
const L3 = Math.log(3);

/** The plot: room on the left for heights, below for the x labels, two rows of steps and a caption. */
const box = (s: Scene): Rect => [13 * s.u, 11 * s.u, s.w - 26 * s.u, s.h - 36 * s.u];
const capY = (s: Scene) => s.h - 6 * s.u;
const rowY = (s: Scene, F: Frame, row: number) => F.Y(0) + (8.5 + 4.6 * row) * s.u;

/** A label under the x axis. */
function tick(s: Scene, F: Frame, x: number, text: string, k: Color, a = 1) {
  s.alpha(a, () => s.text(text, F.X(x), F.Y(0) + 3.6 * s.u, { size: 3.1, font: 'mono', weight: 650, color: s.c(k) }));
}

/** A label left of the plot, at height y. */
function height(s: Scene, F: Frame, y: number, text: string, a = 1, k: Color = 'gold') {
  s.alpha(a, () => s.text(text, F.X(F.dom[0]) - 1.8 * s.u, F.Y(y), { size: 3.2, font: 'mono', weight: 650, align: 'right', color: s.c(k) }));
}

/** One caption per beat, each fading out as the next begins. */
function captions(s: Scene, list: [string, string, (Color | '--ink-2')?][]) {
  list.forEach(([beat, text, k], i) => {
    const next = list[i + 1]?.[0];
    s.alpha(s.ease(beat, 0.4, 0.3) * (next ? 1 - s.ease(next, 0.3) : 1), () => caption(s, text, capY(s), k ?? '--ink-2', 3.5));
  });
}

/** ln read off the curve: across from height y to the curve, then down to x = ln y. */
function read(s: Scene, F: Frame, y: number, prog: number, k: Color) {
  if (prog <= 0) return;
  const x = Math.log(y);
  const a = Math.min(1, prog * 2);
  const b = Math.max(0, prog * 2 - 1);
  F.seg(F.dom[0], y, lerp(F.dom[0], x, a), y, k, 0.4, [1.2, 0.9]);
  if (b > 0.02) F.arrow(x, y, x, lerp(y, 0, b), k, 0.45, 2.2);
}

/** The other way: up from x to the curve, then across to its height. */
function up(s: Scene, F: Frame, x: number, prog: number) {
  if (prog <= 0) return;
  const y = Math.exp(x);
  const a = Math.min(1, prog * 2);
  const b = Math.max(0, prog * 2 - 1);
  F.arrow(x, 0, x, lerp(0, y, a), 'gold', 0.5, 2.2);
  if (b > 0.02) F.arrow(x, y, lerp(x, F.dom[0], b), y, 'gold', 0.5, 2.2);
}

/** One log as a step along x, from a to b, in a row under the axis. */
function step(s: Scene, F: Frame, a: number, b: number, row: number, k: Color, label: string, al: number, la = 1) {
  const y = rowY(s, F, row);
  s.alpha(al, () => {
    s.arrow(F.X(a), y, F.X(b), y, s.c(k), 0.6, 2);
    s.alpha(la, () => s.text(label, F.X(Math.max(a, b)) + 1.6 * s.u, y, { size: 3, font: 'mono', weight: 650, align: 'left', color: s.c(k), halo: true }));
  });
}

/** The curve eˣ with its axes. */
function curve(s: Scene, F: Frame) {
  F.axes();
  s.text('x', F.X(F.dom[1]) - 1 * s.u, F.Y(0) - 3 * s.u, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('orange') });
  F.fn(Math.exp, 'purple', 0.85);
}

const P: View = [0, 2.6, 0, 10.5];
/** A mark's left edge, just inside the plot's y axis. */
const inside = (s: Scene, F: Frame) => ({ x: (F.X(0) + 3 * s.u) / s.w });

const prod: SceneDef = {
  marks: {
    why: { tex: String.raw`e^{0.69} \cdot e^{1.10} = e^{0.69 + 1.10}`, x: 0.06, y: 0.21, size: 4.6, align: 'left' },
    rule: { tex: String.raw`\ln(ab) = \ln a + \ln b`, x: 0.06, y: 0.21, size: 5, align: 'left' },
  },
  draw(s) {
    // By hand: multiplying is slow, adding is quick.
    s.alpha(1 - s.ease('curve', 0.6), () => {
      const o = { size: 5, font: 'mono', weight: 600 } as const;
      const l = { size: 3.4, font: 'mono', weight: 650 } as const;
      s.alpha(s.ease('slow', 0.5), () => {
        s.text('3,255,682 × 9,455,186', s.w / 2, s.h * 0.27, o);
        s.text('slow, and easy to get wrong', s.w / 2, s.h * 0.27 + 6.5 * s.u, { ...l, color: s.c('red') });
      });
      s.alpha(after(s, 'slow', 0.6), () => {
        s.text('3,255,682 + 9,455,186', s.w / 2, s.h * 0.5, o);
        s.text('quick', s.w / 2, s.h * 0.5 + 6.5 * s.u, { ...l, color: s.c('green') });
      });
      s.alpha(after(s, 'napier', 0.45), () => caption(s, 'with logs: × becomes +, ÷ becomes −', s.h * 0.74, 'teal', 3.6));
    });
    cite(s, 'logarithms · John Napier, 1614', s.win('napier', 'curve'));

    const F = new Frame(s, box(s), P);
    s.alpha(s.ease('curve', 0.6, 0.3), () => {
      curve(s, F);
      const r2 = after(s, 'two', 0.1, 1.4);
      const r3 = after(s, 'three', 0.05, 1.4);
      read(s, F, 2, r2, 'teal');
      read(s, F, 3, r3, 'teal');
      height(s, F, 2, '2', Math.min(1, r2 * 4));
      height(s, F, 3, '3', Math.min(1, r3 * 4));
      tick(s, F, L2, '0.69', 'teal', smooth((r2 - 0.85) / 0.15));
      tick(s, F, L3, '1.10', 'orange', smooth((r3 - 0.85) / 0.15));
      // ln 3 slides up to start where ln 2 ends: the steps add.
      const slide = s.ease('six', 1.2, 0.4);
      step(s, F, 0, L2, 0, 'teal', 'ln 2', smooth((r2 - 0.9) / 0.1), 1 - s.ease('six', 0.4, 0.2));
      step(s, F, L2 * slide, L2 * slide + L3, 1 - slide, 'orange', 'ln 3', smooth((r3 - 0.9) / 0.1), 1 - s.ease('six', 0.4, 0.2));
      s.alpha(slide, () => s.text('ln 2 + ln 3', F.X(L2 + L3) + 1.6 * s.u, rowY(s, F, 0), { size: 3, font: 'mono', weight: 650, align: 'left', color: s.c('purple'), halo: true }));
      const r6 = after(s, 'six', 0.5, 1.4);
      up(s, F, L2 + L3, r6);
      tick(s, F, L2 + L3, '1.79', 'purple', smooth((after(s, 'six', 0.3) - 0.5) / 0.5));
      height(s, F, 6, '6', smooth((r6 - 0.85) / 0.15));
    });
    s.show('why', s.ease('why', 0.6, 0.3) * (1 - s.ease('rule', 0.4)), inside(s, F));
    s.show('rule', s.ease('rule', 0.6, 0.3), inside(s, F));
    captions(s, [
      ['curve', 'ln: from a height back to its x', 'teal'],
      ['two', 'ln 2 ≈ 0.69', 'teal'],
      ['three', 'ln 3 ≈ 1.10', 'orange'],
      ['six', '0.69 + 1.10 = 1.79, at height 6 = 2 × 3', 'purple'],
      ['why', 'times: the powers add'],
      ['rule', 'a product: one log per factor, added', 'purple'],
    ]);
  },
};

const pow: SceneDef = {
  marks: {
    k: { tex: String.raw`\ln a^{k} = k \ln a`, x: 0.06, y: 0.45, size: 5, align: 'left' },
  },
  draw(s) {
    const F = new Frame(s, box(s), P);
    curve(s, F);
    // Nine is two equal steps of ln 3.
    step(s, F, 0, L3, 0, 'orange', 'ln 3', s.ease('nine', 0.5, 0.3), 1 - after(s, 'nine', 0.25));
    step(s, F, L3, 2 * L3, 0, 'orange', 'ln 3 + ln 3', after(s, 'nine', 0.25));
    const r9 = after(s, 'nine', 0.4, 1.4);
    up(s, F, 2 * L3, r9);
    tick(s, F, 2 * L3, '2.20', 'purple', smooth((r9 - 0.3) / 0.2));
    height(s, F, 9, '9', smooth((r9 - 0.85) / 0.15));
    s.show('k', s.ease('k', 0.6, 0.4), inside(s, F));
    captions(s, [
      ['nine', '9 = 3 × 3:  ln 9 = ln 3 + ln 3 ≈ 2.20', 'orange'],
      ['k', 'k factors of a: k equal steps', 'orange'],
      ['front', '(ln 3)² ≈ 1.21: a different number', 'red'],
    ]);
  },
};

const Q: View = [-2.6, 1.6, 0, 3.4];

const quot: SceneDef = {
  marks: {
    diff: { tex: String.raw`\ln \tfrac{a}{b} = \ln a - \ln b`, x: 0.06, y: 0.2, size: 5, align: 'left' },
    given: { tex: String.raw`\ln 2 \approx 0.69, \;\; \ln 5 \approx 1.61`, x: 0.06, y: 0.14, size: 4.4, align: 'left' },
    ask: { tex: String.raw`p = \tfrac{1}{10}: \quad -\ln p = \, ?`, x: 0.06, y: 0.25, size: 4.4, align: 'left' },
  },
  draw(s) {
    const F = new Frame(s, box(s), Q);
    curve(s, F);
    const early = 1 - s.ease('small', 0.5);
    s.alpha(early, () => {
      // Two times a half is one: the step for ½ cancels the step for 2.
      const half = s.win('half', 'quot');
      s.alpha(half, () => {
        const r2 = after(s, 'half', 0.05, 1.2);
        read(s, F, 2, r2, 'teal');
        height(s, F, 2, '2', Math.min(1, r2 * 4));
        step(s, F, 0, L2, 0, 'teal', 'ln 2', smooth((r2 - 0.9) / 0.1));
        // Then the ½ step slides from 0.69 back to start at 0, landing at −0.69.
        const fl = s.ease('flip', 1.2, 0.2);
        step(s, F, L2 - L2 * fl, -L2 * fl, 1, 'red', 'ln ½', after(s, 'half', 0.45));
        const rh = after(s, 'flip', 0.35, 1.2);
        read(s, F, 0.5, rh, 'red');
        height(s, F, 0.5, '½', Math.min(1, rh * 4));
        tick(s, F, -L2, '−0.69', 'red', smooth((rh - 0.85) / 0.15));
        s.alpha(after(s, 'half', 0.65) * (1 - s.ease('flip', 0.4)), () => {
          F.dot(0, 1, 'gold', 1.3);
          height(s, F, 1, '1');
          tick(s, F, 0, '0', 'purple');
        });
      });
      // Three halves: ln 3, then back by ln 2.
      s.alpha(s.ease('quot', 0.5, 0.2), () => {
        step(s, F, 0, L3, 0, 'orange', 'ln 3', 1);
        step(s, F, L3, L3 - L2, 1, 'red', 'ln ½', after(s, 'quot', 0.2));
        const r = after(s, 'quot', 0.45, 1.4);
        up(s, F, L3 - L2, r);
        tick(s, F, L3 - L2, '0.41', 'purple', smooth((r - 0.2) / 0.2));
        height(s, F, 1.5, '1.5', smooth((r - 0.85) / 0.15));
      });
    });
    s.show('diff', s.ease('diff', 0.6, 0.3) * (1 - s.ease('small', 0.4)));
    // Below one: how far left of zero is −ln p.
    s.alpha(s.win('small', 'try'), () => {
      [[0.9, 0, 'small', 0.15], [0.5, 1, 'small', 0.45]].forEach(([p, row, beat, f]) => {
        const r = after(s, beat as string, f as number, 1.2);
        read(s, F, p as number, r, 'red');
        height(s, F, p as number, String(p), Math.min(1, r * 4));
        step(s, F, Math.log(p as number), 0, row as number, 'red', (-Math.log(p as number)).toFixed(2), smooth((r - 0.85) / 0.15));
      });
    });
    // The worked problem: p = 1/10 sits 2.30 left of zero.
    s.alpha(s.ease('solve', 0.5, 0.2), () => {
      const r = after(s, 'solve', 0.2, 1.4);
      read(s, F, 0.1, r, 'red');
      height(s, F, 0.1, '0.1', Math.min(1, r * 4));
      step(s, F, Math.log(0.1), 0, 0, 'red', '2.30', smooth((r - 0.85) / 0.15));
    });
    s.show('given', s.ease('try', 0.6, 0.3));
    s.show('ask', after(s, 'try', 0.6));
    captions(s, [
      ['half', '2 × ½ = 1:  ln 2 + ln ½ = 0', 'teal'],
      ['flip', 'ln ½ = −ln 2 ≈ −0.69', 'red'],
      ['quot', 'ln 1.5 = ln 3 − ln 2 ≈ 0.41', 'purple'],
      ['diff', 'a quotient: top log minus bottom log', 'purple'],
      ['small', 'p below 1:  −ln p, how far left of 0', 'red'],
      ['order', 'smaller p, bigger −ln p', 'red'],
      ['try', ''],
      ['ten', '−ln(1/10) = ln 10', 'red'],
      ['solve', 'ln 10 = ln 2 + ln 5 ≈ 0.69 + 1.61 = 2.30', 'red'],
    ]);
  },
};

export const scenes: Record<string, SceneDef> = { prod, pow, quot };

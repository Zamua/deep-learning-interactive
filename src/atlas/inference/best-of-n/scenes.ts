import type { SceneDef } from '../../../lecture/scene';
import { columns } from '../../draw';
import { mark, word } from '../draw';

const PASS = [false, false, true, false];
const P = 0.3;
const MISS4 = (1 - P) ** 4;

const draw: SceneDef = {
  marks: {
    f: { tex: String.raw`\text{hit} = 1 - (1 - p)^n`, x: 0.5, y: 0.88, size: 5 },
  },
  draw(s) {
    const xs = columns(s, 4, Math.min(26, (s.w / s.u - 28) / 3));
    const yA = s.h * 0.13;
    const yM = s.h * 0.25;
    PASS.forEach((ok, i) => {
      s.alpha(s.ease('draw', 0.5, 1.5 + 0.4 * i), () => {
        word(s, xs[i]!, yA, `program ${i}`, ok ? 'green' : 'slate', { size: 2.9, on: ok ? s.ease('check', 0.6, 2) : 0 });
      });
      s.alpha(s.ease('check', 0.4, 0.4 + 0.3 * i), () => {
        mark(s, ok, xs[i]! - 4 * s.u, yM, 4);
        s.text(ok ? 'pass' : 'fail', xs[i]! + 0.5 * s.u, yM, { size: 2.8, font: 'mono', align: 'left', color: s.c(ok ? 'green' : 'red') });
      });
    });
    s.alpha(s.ease('check', 0.6, 2), () => s.text('kept', xs[2]!, yM + 5.5 * s.u, { size: 3, font: 'mono', weight: 650, color: s.c('green') }));
    // All four wrong: four factors of 0.7.
    const yW = s.h * 0.45;
    s.alpha(s.ease('miss', 0.6, 1.4), () => {
      s.text('each wrong: 1 − 0.3 = 0.7', s.w / 2, yW - 7 * s.u, { size: 3, font: 'mono', color: s.c('--ink-2') });
      s.text('all four wrong: 0.7 × 0.7 × 0.7 × 0.7 ≈ 0.24', s.w / 2, yW, { size: 3.1, font: 'mono', weight: 600, color: s.c('red') });
    });
    // Success against failure, as one bar split in two.
    const yB = s.h * 0.64;
    const L = s.w / 2 - 36 * s.u;
    const W = 72 * s.u;
    const hb = 7 * s.u;
    s.alpha(s.ease('hit', 0.6), () => {
      const g = s.ease('hit', 1, 0.3);
      const split = L + W * (1 - MISS4);
      s.rrect(L, yB - hb / 2, (split - L) * g, hb, 1, { fill: s.tint('green', 0.4), stroke: s.c('green'), lw: 0.3 });
      s.rrect(split, yB - hb / 2, L + W - split, hb, 1, { fill: s.tint('red', 0.35), stroke: s.c('red'), lw: 0.3 });
      s.text('one right: 0.76', L, yB + 7.5 * s.u, { size: 3.1, font: 'mono', weight: 650, align: 'left', color: s.c('green') });
      s.text('all wrong: 0.24', L + W, yB + 7.5 * s.u, { size: 3.1, font: 'mono', weight: 650, align: 'right', color: s.c('red') });
    });
    s.show('f', s.ease('formula', 0.6));
  },
};

const NS = [1, 2, 3, 4, 5, 6, 7, 8];
const HIT = NS.map((n) => 1 - (1 - P) ** n);
/** Fooled by 1 wrong answer in 5: a kept answer is right with 0.3 / (0.3 + 0.14). */
const FOOL = NS.map((n) => (P / (P + 0.14)) * (1 - (1 - P - 0.14) ** n));

const enough: SceneDef = {
  draw(s) {
    const half = Math.min(50, s.w / s.u / 2 - 12);
    const l = s.w / 2 - half * s.u;
    const r = s.w / 2 + half * s.u;
    const t = s.h * 0.2;
    const b = s.h * 0.78;
    const X = (i: number) => l + ((i + 0.5) / NS.length) * (r - l);
    const Y = (v: number) => b - v * (b - t);
    const bw = ((r - l) / NS.length) * 0.56;
    const rare = s.win('rare', 'fooled');
    s.alpha(1 - rare, () => {
      s.line(l, b, r, b, s.c('--axis'), 0.35);
      s.text('chance best-of-n succeeds, p = 0.3', s.w / 2, s.h * 0.08, { size: 3.1, font: 'mono', color: s.c('--ink-2') });
      // The 90% target.
      s.alpha(s.ease('seven', 0.6), () => {
        s.line(l, Y(0.9), r, Y(0.9), s.tint('gold', 0.8), 0.3, [1.2, 1]);
        s.text('0.9', l - 1.5 * s.u, Y(0.9), { size: 2.8, font: 'mono', align: 'right', color: s.c('gold') });
      });
      NS.forEach((n, i) => {
        const a = s.ease('curve', 0.4, 0.5 + 0.25 * i);
        s.alpha(a * (1 - 0.55 * s.ease('fooled', 0.6)), () => {
          const hi = n === 7 ? s.ease('seven', 0.6, 2) : 0;
          const k = n === 6 && s.ease('seven', 0.6, 1) > 0 ? 'slate' : 'green';
          const h = HIT[i]! * (b - t) * a;
          s.rrect(X(i) - bw / 2, b - h, bw, h, 1, { fill: s.tint(k, 0.3 + 0.3 * hi), stroke: s.c(k), lw: 0.3 + 0.2 * hi });
          s.text(String(n), X(i), b + 3.4 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
          const show = n <= 3 ? s.ease('curve', 0.5, 1.5 + 0.8 * i) : n === 6 || n === 7 ? s.ease('seven', 0.6, 1) : 0;
          s.alpha(show * (1 - s.ease('fooled', 0.5)), () => s.text(HIT[i]!.toFixed(2), X(i), b - h - 3 * s.u, { size: 2.8, font: 'mono', weight: 600, color: s.c(k), halo: true }));
        });
      });
      s.text('n', r + 2 * s.u, b + 3.4 * s.u, { size: 3, font: 'mono', weight: 650, align: 'left', color: s.c('--ink-3') });
      // A checker fooled 1 time in 5 levels off below 1.
      s.alpha(s.ease('fooled', 0.6, 0.6), () => {
        const g = s.ease('fooled', 1.2, 1);
        s.ctx.beginPath();
        NS.forEach((_, i) => (i ? s.ctx.lineTo(X(i), Y(FOOL[i]! * g)) : s.ctx.moveTo(X(i), Y(FOOL[i]! * g))));
        s.ctx.strokeStyle = s.c('red');
        s.ctx.lineWidth = 0.6 * s.u;
        s.ctx.stroke();
        NS.forEach((_, i) => s.circle(X(i), Y(FOOL[i]! * g), 1 * s.u, { fill: s.c('red') }));
        s.text('checker fooled 1 time in 5: levels off near 0.68', s.w / 2, s.h * 0.14, { size: 3, font: 'mono', weight: 650, color: s.c('red') });
      });
      s.alpha(s.ease('strict', 0.6), () => s.text('it must reject wrong answers', s.w / 2, s.h * 0.92, { size: 3.4, font: 'mono', weight: 650, color: s.c('green') }));
    });
    s.alpha(rare, () => {
      s.text('p = 0.1: one sample in ten is right', s.w / 2, s.h * 0.3, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
      s.text('too few to win a vote', s.w / 2, s.h * 0.4, { size: 3.2, font: 'mono', color: s.c('red') });
      s.text('n = 20: 1 − 0.9²⁰ ≈ 0.88', s.w / 2, s.h * 0.58, { size: 4, font: 'mono', weight: 650, color: s.c('green') });
    });
  },
};

export const scenes: Record<string, SceneDef> = { draw, enough };

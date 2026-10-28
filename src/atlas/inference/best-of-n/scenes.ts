import type { Scene, SceneDef } from '../../../lecture/scene';
import { columns } from '../../draw';
import { mark, word, type Ink } from '../draw';

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number): void {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** 0 -> 1 once beat `id` is fraction `f` of the way through its narration. */
const cue = (s: Scene, id: string, f: number): number => Math.min(1, Math.max(0, (s.prog(id) - f) * 8));

/** Four sampled answers to 3x + 7 = 31, and what plugging each back in gives. */
const XS = [6, 8, 9, 7];
const OK = XS.map((x) => 3 * x + 7 === 31);

/** A bar from x0, `len` px long and `h` stage units tall. */
function bar(s: Scene, x0: number, y: number, len: number, k: Ink, h = 4.4): void {
  s.rrect(x0, y - (h / 2) * s.u, Math.max(len, 0.8 * s.u), h * s.u, 1, { fill: s.tint(k, 0.4), stroke: s.c(k), lw: 0.3 });
}

const check: SceneDef = {
  draw(s) {
    const code = s.ease('tests', 0.8);
    // Right answers are rare: one in ten.
    s.alpha(1 - s.ease('easy', 0.6), () => {
      const xs = columns(s, 10, 8);
      s.text('right one time in ten', s.w / 2, s.h * 0.34, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
      xs.forEach((x, i) => s.alpha(s.ease('vote', 0.4, 0.2 + 0.08 * i), () => s.circle(x, s.h * 0.46, 2.4 * s.u, { fill: s.tint(i === 3 ? 'green' : 'red', 0.55), stroke: s.c(i === 3 ? 'green' : 'red'), lw: 0.3 })));
      s.alpha(cue(s, 'vote', 0.55), () => s.text('too few to win a vote', s.w / 2, s.h * 0.58, { size: 3.4, font: 'mono', weight: 600, color: s.c('red') }));
    });
    // The problem, then a coding task in its place.
    const yQ = s.h * 0.2;
    s.alpha(s.ease('easy', 0.6) * (1 - code), () => {
      s.text('3x + 7 = 31', s.w / 2, yQ, { size: 5, font: 'mono', weight: 650, color: s.c('orange') });
      s.alpha(cue(s, 'easy', 0.45), () => s.text('hard to find, easy to check', s.w / 2, yQ + 7 * s.u, { size: 3, font: 'mono', color: s.c('--ink-3') }));
    });
    s.alpha(code, () => {
      s.text('a coding task', s.w / 2, yQ, { size: 4.4, font: 'mono', weight: 650, color: s.c('orange') });
      s.text('checked by its tests', s.w / 2, yQ + 7 * s.u, { size: 3, font: 'mono', color: s.c('--ink-3') });
    });
    // Four samples, each checked.
    const xs = columns(s, 4, s.tall ? 25 : 28);
    const yS = s.h * 0.42;
    const yC = s.h * 0.52;
    XS.forEach((x, i) => {
      const ok = OK[i]!;
      const kept = ok ? s.ease('name', 0.6, 0.6) : 0;
      s.alpha(s.ease('draw', 0.5, 0.4 + 0.35 * i), () => {
        s.alpha(1 - code, () => word(s, xs[i]!, yS, `x = ${x}`, ok && s.ease('check', 0.6, 1.5) > 0 ? 'green' : 'slate', { size: 3.2, on: kept }));
        s.alpha(code, () => word(s, xs[i]!, yS, `program ${i}`, ok ? 'green' : 'slate', { size: 2.8, on: kept }));
      });
      s.alpha(s.ease('check', 0.5, 0.3 + 0.4 * i), () => {
        s.alpha(1 - code, () => {
          s.text(`3 × ${x} + 7`, xs[i]!, yC, { size: 2.8, font: 'mono', color: s.c('--ink-2') });
          s.text(`= ${3 * x + 7}`, xs[i]! - 1.5 * s.u, yC + 5 * s.u, { size: 3, font: 'mono', weight: 600, color: s.c(ok ? 'green' : 'red') });
        });
        s.alpha(code, () => s.text(ok ? 'tests pass' : 'tests fail', xs[i]! - 1.5 * s.u, yC + 5 * s.u, { size: 2.8, font: 'mono', weight: 600, color: s.c(ok ? 'green' : 'red') }));
        mark(s, ok, xs[i]! + (code > 0.5 ? 9 : 6) * s.u, yC + 5 * s.u, 3.4);
      });
    });
    s.alpha(s.ease('name', 0.6, 0.6), () => s.text('kept', xs[1]!, yC + 11 * s.u, { size: 3, font: 'mono', weight: 650, color: s.c('green') }));
    s.alpha(s.ease('name', 0.6, 1.2) * (1 - s.ease('chen', 0.5)), () => s.text('best-of-n: draw n, keep one that passes', s.w / 2, s.h * 0.86, { size: 3.1, font: 'mono', weight: 600, color: s.c('--ink-2') }));
    // Chen et al.: one sample against any of a hundred.
    cite(s, 'Chen et al. · OpenAI, 2021', s.ease('chen', 0.6));
    s.alpha(s.ease('chen', 0.6, 0.3), () => {
      const x0 = s.w / 2 - 34 * s.u;
      const full = 46 * s.u;
      const lab = (t: string, y: number, v: number, k: Ink) => s.text(t, x0 + full * v + 2 * s.u, y, { size: 3, font: 'mono', weight: 600, align: 'left', color: s.c(k) });
      bar(s, x0, s.h * 0.8, full * 0.288, 'slate');
      lab('1 sample: 28.8%', s.h * 0.8, 0.288, '--ink-2');
      s.alpha(cue(s, 'chen', 0.55), () => {
        const g = Math.min(1, cue(s, 'chen', 0.55) * 1);
        bar(s, x0, s.h * 0.89, full * 0.702 * g, 'green');
        lab('any of 100: 70.2%', s.h * 0.89, 0.702 * g, 'green');
      });
    });
  },
};

const P = 0.3;

const odds: SceneDef = {
  marks: {
    f: { tex: String.raw`\text{hit} = 1 - (1 - p)^n`, x: 0.5, y: 0.92, size: 5 },
  },
  draw(s) {
    const W = s.w * (s.tall ? 0.56 : 0.5);
    const x0 = s.w / 2 - W / 2 - (s.tall ? 14 : 10) * s.u;
    const lab = (t: string, x: number, y: number, k: Ink, align: CanvasTextAlign = 'left') => s.text(t, x, y, { size: 3, font: 'mono', weight: 600, align, color: s.c(k), halo: true });
    // One sample: right with chance p, wrong with 1 − p.
    const y1 = s.h * 0.24;
    s.text('one sample', x0, y1 - 6 * s.u, { size: 3, font: 'mono', align: 'left', color: s.c('--ink-3') });
    s.rrect(x0, y1 - 2.2 * s.u, W, 4.4 * s.u, 1, { stroke: s.c('--ink-3'), lw: 0.3 });
    s.alpha(s.ease('p', 0.6, 1.5), () => {
      bar(s, x0, y1, W * P, 'green');
      lab('p = 0.3', x0, y1 + 5.5 * s.u, 'green');
    });
    s.alpha(s.ease('wrong', 0.6, 1.5), () => {
      bar(s, x0 + W * P, y1, W * (1 - P), 'red');
      lab('1 − p = 0.7', x0 + W + 2 * s.u, y1, 'red');
    });
    // All wrong after n samples: each one keeps 0.7 of the last.
    const dim = 1 - 0.92 * s.ease('add', 0.6);
    s.alpha(s.ease('miss', 0.6) * dim, () => {
      s.text('all wrong, after n samples', x0, s.h * 0.36, { size: 3, font: 'mono', align: 'left', color: s.c('--ink-3') });
      for (let n = 1; n <= 4; n++) {
        const y = s.h * (0.36 + 0.08 * n);
        const v = (1 - P) ** n;
        const g = s.ease('miss', 0.6, 1.2 + 0.5 * n);
        s.alpha(g, () => {
          bar(s, x0, y, W * v * g, 'red');
          lab(`n = ${n}: ${n === 3 ? '0.343' : String(+v.toFixed(2))}`, x0 + W * v + 2 * s.u, y, 'red');
        });
      }
    });
    // A hit: everything but all-wrong.
    const yH = s.h * 0.8;
    const miss4 = (1 - P) ** 4;
    s.alpha(s.ease('hit', 0.6) * dim, () => {
      const g = s.ease('hit', 1, 0.3);
      bar(s, x0, yH, W * (1 - miss4) * g, 'green', 5.4);
      bar(s, x0 + W * (1 - miss4), yH, W * miss4, 'red', 5.4);
      lab('hit: 1 − 0.24 = 0.76', x0 + W + 2 * s.u, yH, 'green');
    });
    s.show('f', s.ease('formula', 0.6));
    // Chances of "at least one" do not add.
    s.alpha(s.ease('add', 0.6), () => {
      s.text('4 × 0.3 = 1.2', s.w / 2, s.h * 0.5, { size: 5, font: 'mono', weight: 650, color: s.c('red'), halo: true });
      mark(s, false, s.w / 2 + 25 * s.u, s.h * 0.5, 5);
      s.alpha(cue(s, 'add', 0.4), () => s.text('more than certain: samples overlap', s.w / 2, s.h * 0.6, { size: 3.2, font: 'mono', color: s.c('--ink-2'), halo: true }));
    });
  },
};

const NS = [1, 2, 3, 4, 5, 6, 7, 8];
const HIT = NS.map((n) => 1 - (1 - P) ** n);

const many: SceneDef = {
  draw(s) {
    const half = Math.min(48, s.w / s.u / 2 - 12);
    const l = s.w / 2 - half * s.u;
    const r = s.w / 2 + half * s.u;
    const t = s.h * 0.26;
    const b = s.h * 0.8;
    const X = (i: number) => l + ((i + 0.5) / NS.length) * (r - l);
    const Y = (v: number) => b - v * (b - t);
    const bw = ((r - l) / NS.length) * 0.56;
    const rare = s.ease('rare', 0.6);
    s.alpha(1 - rare, () => {
      s.line(l, b, r, b, s.c('--axis'), 0.35);
      s.text('chance of a hit, p = 0.3', s.w / 2, s.h * 0.16, { size: 3.1, font: 'mono', color: s.c('--ink-2') });
      // The 90% target.
      s.alpha(s.ease('target', 0.6), () => {
        s.line(l, Y(0.9), r, Y(0.9), s.tint('gold', 0.8), 0.3, [1.2, 1]);
        s.text('0.9', l - 1.5 * s.u, Y(0.9), { size: 2.8, font: 'mono', align: 'right', color: s.c('gold') });
      });
      NS.forEach((n, i) => {
        const a = s.ease('curve', 0.5, 0.4 + 0.45 * i);
        const k: Ink = n === 6 && s.ease('six', 0.6) > 0 ? 'slate' : 'green';
        const hi = n === 7 ? s.ease('seven', 0.6, 1) : n === 6 ? s.win('six', 'seven') : 0;
        const h = HIT[i]! * (b - t) * a;
        s.alpha(a, () => {
          s.rrect(X(i) - bw / 2, b - h, bw, h, 1, { fill: s.tint(k, 0.3 + 0.3 * hi), stroke: s.c(k), lw: 0.3 + 0.2 * hi });
          s.text(String(n), X(i), b + 3.4 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
          s.text(HIT[i]!.toFixed(2), X(i), b - h - 3 * s.u, { size: 2.6, font: 'mono', weight: 500 + 150 * hi, color: s.c(k), halo: true });
        });
      });
      s.text('n', r + 2 * s.u, b + 3.4 * s.u, { size: 3, font: 'mono', weight: 650, align: 'left', color: s.c('--ink-3') });
      s.alpha(s.win('six', 'seven'), () => s.text('miss: 0.7⁶ ≈ 0.12, above 0.1', s.w / 2, s.h * 0.92, { size: 3.2, font: 'mono', weight: 600, color: s.c('slate') }));
      s.alpha(s.ease('seven', 0.6), () => s.text('miss: 0.7⁷ ≈ 0.08, so n = 7', s.w / 2, s.h * 0.92, { size: 3.2, font: 'mono', weight: 650, color: s.c('green') }));
    });
    s.alpha(rare, () => {
      s.text('p = 0.1: one sample in ten', s.w / 2, s.h * 0.3, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
      s.text('too few to win a vote', s.w / 2, s.h * 0.4, { size: 3.2, font: 'mono', color: s.c('red') });
      s.alpha(cue(s, 'rare', 0.4), () => s.text('n = 20: 1 − 0.9²⁰ ≈ 0.88', s.w / 2, s.h * 0.58, { size: 4, font: 'mono', weight: 650, color: s.c('green') }));
    });
  },
};

/** A hundred samples at p = 0.3, through a verifier fooled by 1 wrong answer in 5. */
const POOL: [string, Ink, number, string, number][] = [
  ['100 samples, p = 0.3', '--ink-2', 500, 'pool', 0.3],
  ['30 right: all pass', 'green', 600, 'pool', 2.5],
  ['70 wrong: 1 in 5 pass = 14', 'red', 600, 'pool', 5],
  ['passed: 30 + 14 = 44', '--ink-2', 600, 'share', 0.3],
  ['kept is right: 30 / 44 ≈ 0.68', 'gold', 700, 'share', 2],
];

function drawPool(s: Scene): void {
  const c = (s.tall ? 4 : 4.6) * s.u;
  const size = s.tall ? 3.1 : 3;
  const textW = Math.max(...POOL.map(([t]) => s.measure(t, { size, font: 'mono', weight: 700 })));
  const gap = 7 * s.u;
  const gx = s.tall ? s.w / 2 - 5 * c : s.w / 2 - (10 * c + gap + textW) / 2;
  const gy = s.tall ? s.h * 0.14 : s.h / 2 - 5 * c;
  const sort = s.ease('pool', 0.6, 5);
  for (let k = 0; k < 100; k++) {
    const x = gx + (k % 10) * c + c / 2;
    const y = gy + Math.floor(k / 10) * c + c / 2;
    const right = k < 30;
    const passed = k < 44;
    const a = Math.min(1, Math.max(0, (s.t - 0.006 * k) / 0.4));
    s.alpha(a * (passed ? 1 : 1 - 0.7 * sort), () => s.circle(x, y, c * 0.36, { fill: s.tint(right ? 'green' : 'red', right || !passed ? 0.55 : 0.55 + 0.35 * sort), stroke: s.c(right ? 'green' : 'red'), lw: 0.2 }));
  }
  // The passed answers, ringed: the pool the kept one comes from.
  s.alpha(s.ease('share', 0.6, 0.3), () => {
    for (let k = 0; k < 44; k++) s.circle(gx + (k % 10) * c + c / 2, gy + Math.floor(k / 10) * c + c / 2, c * 0.48, { stroke: s.c('gold'), lw: 0.3 });
  });
  const tx = s.tall ? s.w / 2 : gx + 10 * c + gap;
  const ty = (i: number) => (s.tall ? gy + 10 * c + (5 + 5.4 * i) * s.u : gy + (1.2 + [0, 1.4, 2.4, 4.6, 5.8][i]!) * c);
  POOL.forEach(([t, k, w, beat, delay], i) =>
    s.alpha(s.ease(beat, 0.6, delay), () => s.text(t, tx, ty(i), { size, font: 'mono', weight: w, align: s.tall ? 'center' : 'left', color: s.c(k) })),
  );
}

/** Success against n, for three verifiers: perfect, fooled 1 time in 5, rejecting 1 right answer in 2. */
const N = 20;
const PERFECT = (n: number) => 1 - (1 - P) ** n;
const FOOLED = (n: number) => (P / (P + 0.14)) * (1 - (1 - P - 0.14) ** n);
const STRICT = (n: number) => 1 - (1 - P / 2) ** n;

function drawCurves(s: Scene): void {
  const l = 16 * s.u;
  const r = s.w - 8 * s.u;
  const t = s.h * 0.16;
  const b = s.h * 0.74;
  const X = (n: number) => l + ((n - 1) / (N - 1)) * (r - l);
  const Y = (v: number) => b - v * (b - t);
  s.line(l, b, r, b, s.c('--axis'), 0.35);
  s.line(l, b, l, t, s.c('--axis'), 0.35);
  for (const v of [0, 0.68, 1]) s.text(String(v), l - 1.5 * s.u, Y(v), { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') });
  for (const n of [1, 5, 10, 15, 20]) s.text(String(n), X(n), b + 3.4 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
  s.text('n', r, b + 7.5 * s.u, { size: 3, font: 'mono', weight: 650, align: 'right', color: s.c('--ink-3') });
  const curve = (f: (n: number) => number, k: Ink, grow: number) => {
    if (grow <= 0) return;
    s.ctx.beginPath();
    const last = 1 + (N - 1) * grow;
    for (let n = 1; n <= last + 1e-9; n += 0.25) (n === 1 ? s.ctx.moveTo(X(n), Y(f(n))) : s.ctx.lineTo(X(n), Y(f(n))));
    s.ctx.strokeStyle = s.c(k);
    s.ctx.lineWidth = 0.6 * s.u;
    s.ctx.stroke();
  };
  const lab = (t: string, y: number, k: Ink) => s.text(t, r, y, { size: 3, font: 'mono', weight: 650, align: 'right', color: s.c(k), halo: true });
  curve(PERFECT, 'green', 1);
  lab('never fooled: climbs to 1', Y(1) - 3.5 * s.u, 'green');
  curve(FOOLED, 'red', s.ease('level', 1.2, 0.3));
  s.alpha(s.ease('level', 0.6, 1.2), () => {
    s.line(l, Y(0.68), r, Y(0.68), s.tint('red', 0.5), 0.25, [1, 1]);
    lab('fooled 1 in 5: levels off', Y(FOOLED(N)) + 4 * s.u, 'red');
  });
  curve(STRICT, 'gold', s.ease('strict', 1.4, 0.5));
  s.alpha(s.ease('strict', 0.6, 1.5), () => lab('rejects 1 right in 2: slower', Y(FOOLED(N)) + 9.5 * s.u, 'gold'));
}

const trust: SceneDef = {
  draw(s) {
    const curves = s.ease('level', 0.6);
    s.alpha(1 - curves, () => drawPool(s));
    s.alpha(curves, () => drawCurves(s));
    cite(s, 'Cobbe et al. · OpenAI, 2021', s.win('cobbe', 'strict'));
    s.alpha(s.win('cobbe', 'strict'), () => {
      s.text('verifier: a trained model', s.w / 2, s.h * 0.86, { size: 3.1, font: 'mono', color: s.c('--ink-2') });
      s.alpha(s.ease('limit', 0.6), () => s.text('past ~400 samples: no gain', s.w / 2, s.h * 0.92, { size: 3.1, font: 'mono', weight: 600, color: s.c('red') }));
    });
    s.alpha(s.ease('must', 0.6), () => s.text('above all: reject wrong answers', s.w / 2, s.h * 0.89, { size: 3.4, font: 'mono', weight: 650, color: s.c('green') }));
  },
};

export const scenes: Record<string, SceneDef> = { check, odds, many, trust };

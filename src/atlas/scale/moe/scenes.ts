import { type Scene, type SceneDef, lerp } from '../../../lecture/scene';
import { bars, box, chip, columns, line, rich } from '../modern-draw';

const P = [0.1, 0.5, 0.15, 0.25];
const TOP = [1, 3];
const GATE = ['', '0.67', '', '0.33'];

/** The four experts in a row, the bars of their router probabilities above them. */
function layout(s: Scene) {
  const xs = columns(s, 4, s.tall ? 25 : 28);
  return { xs, xTok: s.h * 0.1, yRouter: s.h * 0.24, base: s.h * 0.56, yExp: s.h * 0.68 };
}

const router: SceneDef = {
  draw(s) {
    const L = layout(s);
    const cx = s.w / 2;
    chip(s, cx, L.xTok, 'x', 'orange', { w: 9, h: 7, on: 1 });
    const picked = (i: number) => TOP.includes(i);
    const dim = s.ease('top', 0.6);
    L.xs.forEach((x, i) => {
      s.alpha(s.ease('swap', 0.5, 0.6 + 0.25 * i) * (picked(i) ? 1 : 1 - 0.65 * dim), () => {
        box(s, x, L.yExp, `FFN ${i}`, 'green', { w: 19, h: 9, size: 3.2, on: picked(i) ? dim : 0 });
      });
    });
    s.alpha(s.ease('router', 0.6), () => {
      box(s, cx, L.yRouter, 'router', 'purple', { w: 30, h: 8, size: 3.4 });
      s.arrow(cx, L.xTok + 4 * s.u, cx, L.yRouter - 4.5 * s.u, s.c('--ink-3'), 0.35, 2);
    });
    s.alpha(s.ease('router', 0.6, 1.2), () => {
      const g = s.ease('router', 1, 1.2);
      bars(s, L.xs, L.base, P, 'teal', { max: 0.5, height: (L.base - L.yRouter) / s.u - 13, w: 11, grow: g, fmt: (v) => String(v), hi: P.map((_, i) => (picked(i) ? dim : 0)) });
    });
    s.alpha(dim, () => {
      for (const i of TOP) s.arrow(L.xs[i]!, L.base + 1 * s.u, L.xs[i]!, L.yExp - 5 * s.u, s.c('green'), 0.4, 1.8);
      s.text('top k = 2', s.w - 5 * s.u, L.yRouter, { size: 3.2, font: 'mono', align: 'right', color: s.c('green') });
    });
    s.alpha(s.ease('gates', 0.6, 1.5), () => {
      for (const i of TOP) s.text(`gate ${GATE[i]}`, L.xs[i]!, L.yExp + 8.5 * s.u, { size: 3.4, font: 'mono', weight: 600, color: s.c('gold') });
    });
    s.alpha(s.ease('gates', 0.6), () => {
      s.text('kept: 0.5 + 0.25 = 0.75', cx, s.h * 0.84, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
    });
    s.alpha(s.ease('sum', 0.6), () => {
      rich(s, [['out', '--ink'], [' = 0.67 · ', 'gold'], ['FFN 1', 'green'], [' + 0.33 · ', 'gold'], ['FFN 3', 'green']], cx, s.h * 0.92, { size: s.tall ? 3.4 : 3.8 });
    });
  },
};

const params: SceneDef = {
  draw(s) {
    const n = 16;
    const grow = s.ease('grow', 1);
    const cols = 8;
    const pitch = s.tall ? 12.5 : 13.5;
    const xs = columns(s, cols, pitch);
    const rowsY = [s.h * 0.17, s.h * 0.28];
    for (let i = 0; i < n; i++) {
      const extra = i >= 8;
      const a = extra ? grow : s.ease('count', 0.4, 0.3 + 0.12 * i);
      const run = i === 2 || i === 5;
      s.alpha(a, () => box(s, xs[i % cols]!, rowsY[Math.floor(i / cols)]!, '100M', 'green', { w: pitch - 2, h: 8, size: 2.6, on: run ? s.ease('active', 0.6) : 0 }));
    }
    const left = s.tall ? 22 * s.u : 26 * s.u;
    const right = s.w - (s.tall ? 22 : 26) * s.u;
    const full = right - left;
    const bar = (y: number, frac: number, k: 'slate' | 'green', label: string, value: string, a: number) => {
      s.alpha(a, () => {
        s.text(label, left - 2 * s.u, y, { size: 3.4, font: 'mono', weight: 600, align: 'right', color: s.c(k) });
        s.rrect(left, y - 3 * s.u, Math.max(1, full * frac), 6 * s.u, 1, { fill: s.tint(k, 0.35), stroke: s.c(k), lw: 0.3 });
        s.text(value, left + full * frac + 2 * s.u, y, { size: 3.4, font: 'mono', align: 'left', color: s.c(k), halo: true });
      });
    };
    const tot = lerp(800, 1600, grow);
    bar(s.h * 0.48, (tot / 1600) * 0.8, 'slate', 'total', tot < 1000 ? `${Math.round(tot / 10) * 10}M` : `${(tot / 1000).toFixed(1)}B`, s.ease('total', 0.6));
    bar(s.h * 0.62, (200 / 1600) * 0.8, 'green', 'active', '200M', s.ease('active', 0.6));
    line(s, s.ease('total', 0.6, 1.5) * (1 - grow), 'memory: every expert, 8 × 100M', s.w / 2, s.h * 0.76, '--ink-3', { size: 3.2 });
    line(s, s.ease('active', 0.6, 1.5) * (1 - grow), 'compute: k = 2 experts, 2 × 100M', s.w / 2, s.h * 0.84, '--ink-3', { size: 3.2 });
    line(s, s.ease('grow', 0.6, 1.2), '16 experts: total doubles, active stays', s.w / 2, s.h * 0.8, 'green', { size: 3.4, weight: 600 });
  },
};

// Each expert's share of the tokens at each stage of the story.
const SHARES = {
  favor: [0.31, 0.24, 0.22, 0.23],
  feed: [0.55, 0.15, 0.14, 0.16],
  collapse: [0.85, 0.05, 0.04, 0.06],
  fix: [0.25, 0.25, 0.25, 0.25],
};

const balance: SceneDef = {
  draw(s) {
    const a = s.ease('feed', 1.5);
    const b = s.ease('collapse', 1.5);
    const c = s.ease('fix', 1.5);
    const sh = SHARES.favor.map((v, i) => lerp(lerp(lerp(v, SHARES.feed[i]!, a), SHARES.collapse[i]!, b), SHARES.fix[i]!, c));
    const xs = columns(s, 4, s.tall ? 22 : 26);
    const base = s.h * 0.76;
    const height = (s.h * 0.5) / s.u;
    s.text('share of the tokens', s.w / 2, s.h * 0.1, { size: 3.4, color: s.c('--ink-3') });
    bars(s, xs, base, sh, 'green', { max: 0.9, height, w: 13, fmt: (v) => `${Math.round(v * 100)}%`, hi: [1 - c, 0, 0, 0] });
    xs.forEach((x, i) => s.text(`FFN ${i}`, x, base + 4 * s.u, { size: 3.2, font: 'mono', color: s.c('--ink-2') }));
    s.alpha(s.ease('feed', 0.6, 0.5) * (1 - c), () => {
      s.text('more tokens → more gradient → better → more tokens', s.w / 2, s.h * 0.88, { size: s.tall ? 2.9 : 3.3, font: 'mono', color: s.c('red') });
    });
    s.alpha(s.ease('collapse', 0.6, 2) * (1 - c), () => {
      s.text('idle', (xs[2]! + xs[3]!) / 2, base - 18 * s.u, { size: 3.6, weight: 650, color: s.c('red') });
    });
    s.alpha(c, () => {
      const y = base - (0.25 / 0.9) * height * s.u;
      s.line(xs[0]! - 9 * s.u, y, xs[3]! + 9 * s.u, y, s.c('gold'), 0.35, [1.2, 1]);
      s.text('balancing loss: lowest at 1 / E each', s.w / 2, s.h * 0.88, { size: 3.4, weight: 600, color: s.c('gold') });
    });
  },
};

const RUN = [2, 5];

const model: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const pitch = s.tall ? 9.5 : 10.5;
    const xs = columns(s, 8, pitch).map((x) => x + 5 * u);
    const ys = [0.3, 0.39, 0.48, 0.57].map((f) => s.h * f);
    const act = s.ease('active', 0.6);
    const tot = s.ease('total', 0.6);
    ys.forEach((y, l) =>
      s.alpha(s.ease('layers', 0.5, 0.3 + 0.5 * l), () => {
        s.text(`layer ${l}`, xs[0]! - 6.5 * u, y, { size: 2.8, font: 'mono', weight: 600, align: 'right', color: s.c('--ink-2') });
        xs.forEach((x, i) => {
          const run = RUN.includes(i);
          s.alpha(run ? 1 : 1 - 0.6 * act * (1 - tot), () => box(s, x, y, '100M', 'green', { w: pitch - 1.5, h: 7, size: 2.3, on: run ? act * (1 - tot) + tot : tot }));
        });
      }),
    );
    s.alpha(s.ease('shared', 0.6), () => box(s, cx + 5 * u, s.h * 0.14, 'shared 500M: attention, embeddings', 'purple', { w: 8 * pitch - 1.5, h: 8, size: s.tall ? 2.8 : 3.1, on: 0.5 }));
    const o = { size: s.tall ? 3.1 : 3.5, weight: 600 };
    s.alpha(act, () => rich(s, [['active: 4 × 2 × 100M + 500M = ', '--ink-2'], ['1,300M', 'green']], cx, s.h * 0.73, o));
    s.alpha(tot, () => rich(s, [['total: 4 × 8 × 100M + 500M = ', '--ink-2'], ['3,700M', 'slate']], cx, s.h * 0.83, o));
  },
};

export const scenes: Record<string, SceneDef> = { router, balance, params, model };

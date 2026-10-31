import { type Scene, type SceneDef, lerp } from '../../../lecture/scene';
import { bars, cite, columns } from '../../draw';
import { rich } from '../../linear-algebra/draw';
import { box, chip } from '../../sequences/draw';
import { line } from '../modern-draw';

/** One labelled bar from `left`, its value written just past its end. */
function meter(s: Scene, y: number, frac: number, k: 'slate' | 'green' | 'red', label: string, value: string, a: number) {
  const left = (s.tall ? 22 : 26) * s.u;
  const full = s.w - left - (s.tall ? 20 : 26) * s.u;
  s.alpha(a, () => {
    s.text(label, left - 2 * s.u, y, { size: 3.3, font: 'mono', weight: 600, align: 'right', color: s.c(k) });
    s.rrect(left, y - 3 * s.u, Math.max(1, full * frac), 6 * s.u, 1, { fill: s.tint(k, 0.35), stroke: s.c(k), lw: 0.3 });
    s.text(value, left + full * frac + 2 * s.u, y, { size: 3.3, font: 'mono', align: 'left', color: s.c(k), halo: true });
  });
}

const RUN = [2, 5];

const idea: SceneDef = {
  draw(s) {
    const cx = s.w / 2;
    const yTok = s.h * 0.13;
    const yAtt = s.h * 0.25;
    const yMlp = s.h * 0.4;
    const many = s.ease('many', 0.8);
    const grow = s.ease('grow', 1);
    chip(s, cx, yTok, 'x', 'orange', { w: 9, h: 7, on: 1 });
    s.arrow(cx, yTok + 3.8 * s.u, cx, yAtt - 4.4 * s.u, s.c('--ink-3'), 0.3, 1.6);
    box(s, cx, yAtt, 'attention', 'purple', { w: 34, h: 8, size: 3.4 });

    // One MLP that every token runs whole; widening it widens every token's work.
    const wide = s.ease('mlp', 1.5, 12.2);
    s.alpha(1 - many, () => {
      s.arrow(cx, yAtt + 4 * s.u, cx, yMlp - 5.5 * s.u, s.c('--ink-3'), 0.3, 1.6);
      box(s, cx, yMlp, 'MLP', 'green', { w: lerp(26, 56, wide), h: 10, size: 3.6, on: 0.6 });
      meter(s, s.h * 0.62, lerp(0.3, 0.6, wide), 'red', 'work', 'per token', s.ease('mlp', 0.6, 9.9));
    });

    // Many MLPs side by side, each token lit through two of them.
    const pitch = s.tall ? 12.5 : 13.5;
    const xs = columns(s, 8, pitch);
    const rows = [yMlp, yMlp + 10 * s.u];
    const sized = s.ease('E', 0.6);
    for (let i = 0; i < 16; i++) {
      const extra = i >= 8;
      const a = extra ? grow : many * s.ease('many', 0.4, 0.3 + 0.12 * i);
      const run = RUN.includes(i);
      const lit = run ? Math.max(s.win('many', 'E') * 0.9, s.ease('active', 0.6)) : 0;
      s.alpha(a, () => box(s, xs[i % 8]!, rows[Math.floor(i / 8)]!, sized > 0.5 ? '100M' : String(i), 'green', { w: pitch - 2, h: 8, size: sized > 0.5 ? 2.5 : 3, on: lit }));
    }
    s.alpha(many * (1 - grow), () => {
      for (const i of RUN) s.arrow(cx, yAtt + 4 * s.u, xs[i]!, yMlp - 4.5 * s.u, s.tint('green', 0.8), 0.3, 1.6);
    });
    s.alpha(s.ease('name', 0.6) * (1 - grow), () => s.text(sized > 0.5 ? 'E = 8 experts, 100M each' : '8 experts', cx, yMlp + 7.5 * s.u, { size: 3.2, font: 'mono', weight: 600, color: s.c('green') }));

    // Stored versus run.
    const tot = lerp(800, 1600, grow);
    meter(s, s.h * 0.62, (tot / 1600) * 0.8, 'slate', 'total', tot < 1000 ? `${Math.round(tot / 10) * 10}M` : `${(tot / 1000).toFixed(1)}B`, s.ease('total', 0.6));
    meter(s, s.h * 0.74, (200 / 1600) * 0.8, 'green', 'active', '200M', s.ease('active', 0.6));
    const o = { size: s.tall ? 3.1 : 3.4, font: 'mono' as const };
    line(s, s.ease('total', 0.6, 1.5) * (1 - grow), 'stored: E × 100M = 8 × 100M', cx, s.h * 0.85, '--ink-3', o);
    line(s, s.ease('active', 0.6, 1.5) * (1 - grow), 'run per token: k × 100M = 2 × 100M', cx, s.h * 0.92, '--ink-3', o);
    line(s, s.ease('grow', 0.6, 1.2), '16 experts: total doubles, active stays', cx, s.h * 0.88, 'green', { size: s.tall ? 3.2 : 3.5, weight: 600, font: 'mono' });
    cite(s, 'Jacobs, Jordan, Nowlan & Hinton, 1991', s.win('name', 'E'));
  },
};

const P = [0.1, 0.5, 0.15, 0.25];
const TOP = [1, 3];
const GATE = ['', '2/3', '', '1/3'];

const router: SceneDef = {
  draw(s) {
    const cx = s.w / 2;
    const xs = columns(s, 4, s.tall ? 25 : 28);
    const yTok = s.h * 0.08;
    const yRouter = s.h * 0.22;
    const base = s.h * 0.54;
    const yExp = s.h * 0.66;
    const later = s.ease('shazeer', 0.8);
    const picked = (i: number) => TOP.includes(i);
    const dim = s.ease('top', 0.6);
    s.alpha(1 - later, () => {
      chip(s, cx, yTok, 'x', 'orange', { w: 9, h: 7, on: 1 });
      xs.forEach((x, i) => {
        s.alpha(picked(i) ? 1 : 1 - 0.65 * dim, () => box(s, x, yExp, `expert ${i}`, 'green', { w: s.tall ? 22 : 24, h: 9, size: 3, on: picked(i) ? dim : 0 }));
      });
      box(s, cx, yRouter, 'router', 'purple', { w: 30, h: 8, size: 3.4, on: s.ease('router', 0.6) });
      s.arrow(cx, yTok + 4 * s.u, cx, yRouter - 4.5 * s.u, s.c('--ink-3'), 0.35, 2);
      s.alpha(s.ease('router', 0.6, 0.8), () => s.text('linear layer, then softmax', cx, yRouter + 7 * s.u, { size: 3, font: 'mono', color: s.c('--ink-3') }));
      s.alpha(s.ease('router', 0.6, 3), () => {
        const g = s.ease('router', 1, 3);
        bars(s, xs, base, P, 'teal', { max: 0.5, height: (base - yRouter) / s.u - 17, w: 11, grow: g, fmt: (v) => String(v), hi: P.map((_, i) => (picked(i) ? dim : 0)) });
      });
      s.alpha(dim, () => {
        for (const i of TOP) s.arrow(xs[i]!, base + 1 * s.u, xs[i]!, yExp - 5 * s.u, s.c('green'), 0.4, 1.8);
        s.text('top k = 2', s.w - 5 * s.u, yRouter, { size: 3.2, font: 'mono', align: 'right', color: s.c('green') });
      });
      s.alpha(s.ease('gate', 0.6, 1), () => {
        for (const i of TOP) s.text(s.ease('gates', 0.6, 1.5) > 0.5 ? `gate ${GATE[i]}` : 'gate ?', xs[i]!, yExp + 8.5 * s.u, { size: 3.4, font: 'mono', weight: 600, color: s.c('gold') });
      });
      s.alpha(s.ease('kept', 0.6), () => s.text('kept: 0.5 + 0.25 = 0.75', cx, s.h * 0.83, { size: 3.4, font: 'mono', color: s.c('--ink-2') }));
      s.alpha(s.ease('gates', 0.6), () => s.text('0.5 / 0.75 = 2/3,  0.25 / 0.75 = 1/3', cx, s.h * 0.89, { size: s.tall ? 3 : 3.3, font: 'mono', color: s.c('gold') }));
      s.alpha(s.ease('sum', 0.6), () => {
        const o = { size: s.tall ? 3.2 : 3.6 };
        rich(s, [['out', '--ink'], [' = 2/3 · ', 'gold'], ['expert 1', 'green'], [' + 1/3 · ', 'gold'], ['expert 3', 'green']], cx, s.h * 0.95, o);
      });
    });

    // Sparsely gated: many experts, all but a few gates zero for this token.
    const lep = s.ease('gshard', 0.8);
    s.alpha(later * (1 - lep), () => {
      const cols = 16;
      const n = 64;
      const pitch = Math.min(5.6, (s.w / s.u - 12) / cols);
      const lit = [5, 22, 41, 58];
      for (let i = 0; i < n; i++) {
        const x = s.w / 2 + ((i % cols) - (cols - 1) / 2) * pitch * s.u;
        const y = s.h * 0.3 + Math.floor(i / cols) * pitch * s.u;
        const on = lit.includes(i);
        s.rrect(x - (pitch / 2 - 0.5) * s.u, y - (pitch / 2 - 0.5) * s.u, (pitch - 1) * s.u, (pitch - 1) * s.u, 0.5, { fill: s.tint('green', on ? 0.6 : 0.1), stroke: s.tint('green', on ? 1 : 0.35), lw: 0.2 });
      }
      s.text('many experts: a few gates on,', cx, s.h * 0.66, { size: s.tall ? 3.2 : 3.5, font: 'mono', color: s.c('--ink-2') });
      s.text('all the rest: gate 0', cx, s.h * 0.72, { size: s.tall ? 3.2 : 3.5, font: 'mono', weight: 600, color: s.c('gold') });
    });
    cite(s, 'Shazeer et al., 2017', s.win('shazeer', 'gshard'));

    // In a transformer: every other block's MLP becomes an MoE layer.
    s.alpha(lep, () => {
      const ys = [0.2, 0.38, 0.56, 0.74].map((f) => s.h * f);
      const w = s.tall ? 30 : 34;
      ys.forEach((y, b) => {
        const moe = b % 2 === 1;
        s.text(`block ${b}`, cx - (w + 4) * s.u, y, { size: 3, font: 'mono', weight: 600, align: 'right', color: s.c('--ink-2') });
        box(s, cx - (w / 2 + 1) * s.u, y, 'attention', 'purple', { w, h: 8, size: 3 });
        box(s, cx + (w / 2 + 1) * s.u, y, moe ? 'MoE, k = 2' : 'MLP', 'green', { w, h: 8, size: 3, on: moe ? 0.8 : 0 });
        if (b < 3) s.arrow(cx, y + 4.5 * s.u, cx, ys[b + 1]! - 4.5 * s.u, s.c('--ink-3'), 0.3, 1.6);
      });
      s.text('every other block: MoE in place of the MLP', cx, s.h * 0.88, { size: s.tall ? 3 : 3.4, font: 'mono', weight: 600, color: s.c('green') });
    });
    cite(s, 'Lepikhin et al., 2020', lep);
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
    const xs = columns(s, 4, s.tall ? 24 : 26);
    const base = s.h * 0.74;
    const height = (s.h * 0.48) / s.u;
    s.text('share of the tokens', s.w / 2, s.h * 0.12, { size: 3.4, color: s.c('--ink-3') });
    bars(s, xs, base, sh, 'green', { max: 0.9, height, w: 13, fmt: (v) => `${Math.round(v * 100)}%`, hi: [1 - c, 0, 0, 0] });
    xs.forEach((x, i) => s.text(`expert ${i}`, x, base + 4 * s.u, { size: 3, font: 'mono', color: s.c('--ink-2') }));
    s.alpha(s.ease('feed', 0.6, 0.5) * (1 - c), () => {
      s.text('more tokens → more gradient', s.w / 2, s.h * 0.86, { size: s.tall ? 3.1 : 3.4, font: 'mono', color: s.c('red') });
      s.text('→ better → more tokens', s.w / 2, s.h * 0.92, { size: s.tall ? 3.1 : 3.4, font: 'mono', color: s.c('red') });
    });
    s.alpha(s.ease('collapse', 0.6, 2) * (1 - c), () => {
      s.text('idle', (xs[2]! + xs[3]!) / 2, base - 18 * s.u, { size: 3.6, weight: 650, color: s.c('red') });
    });
    s.alpha(c, () => {
      const y = base - (0.25 / 0.9) * height * s.u;
      s.line(xs[0]! - 9 * s.u, y, xs[3]! + 9 * s.u, y, s.c('gold'), 0.35, [1.2, 1]);
      s.text('balancing loss: lowest at 1 / E each', s.w / 2, s.h * 0.88, { size: s.tall ? 3.2 : 3.4, weight: 600, color: s.c('gold') });
    });
    cite(s, 'Shazeer et al., 2017', s.win('feed', 'collapse'));
  },
};

const model: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const pitch = s.tall ? 9.5 : 10.5;
    const xs = columns(s, 8, pitch).map((x) => x + 5 * u);
    const ys = [0.3, 0.39, 0.48, 0.57].map((f) => s.h * f);
    const run = s.ease('run', 0.6);
    const st = s.ease('stored', 0.6);
    ys.forEach((y, l) =>
      s.alpha(s.ease('layers', 0.5, 0.3 + 0.5 * l), () => {
        s.text(`layer ${l}`, xs[0]! - 6.5 * u, y, { size: 2.8, font: 'mono', weight: 600, align: 'right', color: s.c('--ink-2') });
        xs.forEach((x, i) => {
          const r = RUN.includes(i);
          s.alpha(r ? 1 : 1 - 0.6 * run * (1 - st), () => box(s, x, y, '100M', 'green', { w: pitch - 1.5, h: 7, size: 2.3, on: r ? run * (1 - st) + st : st }));
        });
      }),
    );
    s.alpha(s.ease('shared', 0.6), () => box(s, cx + 5 * u, s.h * 0.14, 'shared 500M: attention, ...', 'purple', { w: 8 * pitch - 1.5, h: 8, size: s.tall ? 2.8 : 3.1, on: s.win('active', 'stored') + s.ease('total', 0.6) }));
    const o = { size: s.tall ? 3.1 : 3.5, weight: 600 };
    s.alpha(run, () => rich(s, [['run: 4 × 2 × 100M = ', '--ink-2'], ['800M', 'green']], cx, s.h * 0.69, o));
    s.alpha(s.ease('active', 0.6), () => rich(s, [['active: 800M + 500M = ', '--ink-2'], ['1,300M', 'green']], cx, s.h * 0.75, o));
    s.alpha(st, () => rich(s, [['stored: 4 × 8 × 100M = ', '--ink-2'], ['3,200M', 'slate']], cx, s.h * 0.84, o));
    s.alpha(s.ease('total', 0.6), () => rich(s, [['total: 3,200M + 500M = ', '--ink-2'], ['3,700M', 'slate']], cx, s.h * 0.9, o));
  },
};

export const scenes: Record<string, SceneDef> = { idea, router, balance, model };
